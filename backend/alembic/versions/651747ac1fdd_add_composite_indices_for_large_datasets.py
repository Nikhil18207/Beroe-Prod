"""add_composite_indices_for_large_datasets

Revision ID: 651747ac1fdd
Revises: add_activity_logs
Create Date: 2026-02-27 00:55:06.946137

Optimizes spend_data_rows table for N million row datasets:
- Replaces single-column indices with composite indices
- Enables efficient pagination, filtering, and sorting
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '651747ac1fdd'
down_revision: Union[str, None] = 'add_activity_logs'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop old single-column indices (if they exist)
    # Using try/except since indices may not exist in all environments
    try:
        op.drop_index('ix_spend_data_rows_category', table_name='spend_data_rows')
    except Exception:
        pass
    try:
        op.drop_index('ix_spend_data_rows_country', table_name='spend_data_rows')
    except Exception:
        pass
    try:
        op.drop_index('ix_spend_data_rows_supplier_name', table_name='spend_data_rows')
    except Exception:
        pass

    # Create new composite indices for efficient large dataset queries
    op.create_index(
        'idx_spend_rows_data_id_row_num',
        'spend_data_rows',
        ['spend_data_id', 'row_number'],
        unique=False
    )
    op.create_index(
        'idx_spend_rows_data_id_supplier',
        'spend_data_rows',
        ['spend_data_id', 'supplier_name'],
        unique=False
    )
    op.create_index(
        'idx_spend_rows_data_id_country',
        'spend_data_rows',
        ['spend_data_id', 'country'],
        unique=False
    )
    op.create_index(
        'idx_spend_rows_data_id_category',
        'spend_data_rows',
        ['spend_data_id', 'category'],
        unique=False
    )
    op.create_index(
        'idx_spend_rows_data_id_spend',
        'spend_data_rows',
        ['spend_data_id', 'spend_amount'],
        unique=False
    )


def downgrade() -> None:
    # Drop composite indices
    op.drop_index('idx_spend_rows_data_id_spend', table_name='spend_data_rows')
    op.drop_index('idx_spend_rows_data_id_category', table_name='spend_data_rows')
    op.drop_index('idx_spend_rows_data_id_country', table_name='spend_data_rows')
    op.drop_index('idx_spend_rows_data_id_supplier', table_name='spend_data_rows')
    op.drop_index('idx_spend_rows_data_id_row_num', table_name='spend_data_rows')

    # Recreate old single-column indices
    op.create_index('ix_spend_data_rows_supplier_name', 'spend_data_rows', ['supplier_name'], unique=False)
    op.create_index('ix_spend_data_rows_country', 'spend_data_rows', ['country'], unique=False)
    op.create_index('ix_spend_data_rows_category', 'spend_data_rows', ['category'], unique=False)
