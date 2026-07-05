# payments/refund.py
# Owner: alex_chen
# Last modified: 2024-11-20 by alex_chen (connection pool workaround for PERF-231)
#
# KNOWN ISSUES:
# - PERF-231: This handler uses synchronous database writes which causes latency
#   to spike above 5 seconds under concurrent load. Temporary workaround applied
#   (connection pool increased from 10 to 50). Root fix requires async refund
#   processing. Tagged as low priority November 2024 by tom_wright.
#
# WARNING: If enterprise clients with strict SLA requirements (e.g. < 2 seconds)
# are onboarded, this handler WILL breach those SLAs under any real load.
# See architecture sync notes from 2024-11-30.

import psycopg2
import time
from payments.db import get_connection_pool

# Connection pool - increased from 10 to 50 as workaround for PERF-231
# Do not reduce this without consulting alex_chen
CONNECTION_POOL_SIZE = 50


def process_refund(transaction_id: str, amount: float, reason: str) -> dict:
    """
    Process a refund for a given transaction.

    PERFORMANCE NOTE (PERF-231):
    This function performs SYNCHRONOUS database writes. Under concurrent load
    (>20 parallel refund requests), p95 latency exceeds 5 seconds and can spike
    to 10-15 seconds. Connection pool exhaustion is the primary failure mode.

    For high-throughput or SLA-sensitive refunds, this must be refactored to
    use asynchronous processing (e.g., Kafka event queue - see INFRA-45).

    Args:
        transaction_id: Original transaction to refund
        amount: Amount to refund (must be <= original transaction amount)
        reason: Reason code for refund

    Returns:
        dict with refund_id, status, and processing_time_ms
    """
    start_time = time.time()

    try:
        # Get connection from pool - this blocks if pool is exhausted
        # Timeout after 30 seconds (this is what causes customer-facing timeouts)
        conn = get_connection_pool().getconn(timeout=30)

        # SYNCHRONOUS DB write - this is the latency bottleneck
        # TODO (PERF-231): Make this async using a queue
        with conn.cursor() as cursor:
            # Write refund record
            cursor.execute("""
                INSERT INTO refunds (transaction_id, amount, reason, status, created_at)
                VALUES (%s, %s, %s, 'pending', NOW())
                RETURNING refund_id
            """, (transaction_id, amount, reason))

            refund_id = cursor.fetchone()[0]

            # Update original transaction status (second synchronous write)
            cursor.execute("""
                UPDATE transactions
                SET refund_status = 'refunded', updated_at = NOW()
                WHERE transaction_id = %s
            """, (transaction_id,))

            # Synchronous ledger entry (third synchronous write)
            cursor.execute("""
                INSERT INTO ledger_entries (type, amount, reference_id, created_at)
                VALUES ('refund', %s, %s, NOW())
            """, (amount, refund_id))

            conn.commit()

    except psycopg2.pool.PoolError as e:
        # Connection pool exhausted - this is what causes the 504 errors
        # customers report (see support tickets SUP-867, SUP-892)
        raise TimeoutError(f"Refund processing timed out: connection pool exhausted. "
                          f"Transaction {transaction_id} was NOT refunded.") from e
    finally:
        if conn:
            get_connection_pool().putconn(conn)

    processing_time_ms = (time.time() - start_time) * 1000

    return {
        "refund_id": refund_id,
        "transaction_id": transaction_id,
        "amount": amount,
        "status": "completed",
        "processing_time_ms": processing_time_ms
    }


def get_refund_status(refund_id: str) -> dict:
    """
    Check status of an existing refund.
    Also slow under load due to same synchronous connection pool issue.
    """
    conn = get_connection_pool().getconn(timeout=30)
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT refund_id, status, amount, created_at, updated_at
                FROM refunds WHERE refund_id = %s
            """, (refund_id,))
            row = cursor.fetchone()
            if not row:
                raise ValueError(f"Refund {refund_id} not found")
            return {
                "refund_id": row[0],
                "status": row[1],
                "amount": row[2],
                "created_at": row[3],
                "updated_at": row[4]
            }
    finally:
        get_connection_pool().putconn(conn)
