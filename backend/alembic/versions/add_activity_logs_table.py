"""Add activity_logs table for Super Admin monitoring

Revision ID: add_activity_logs
Revises: add_multi_tenant
Create Date: 2026-02-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_activity_logs'
down_revision = 'add_multi_tenant'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create activity_logs table
    op.create_table(
        'activity_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('activity_type', sa.String(50), nullable=False),
        sa.Column('description', sa.String(500), nullable=False),
        sa.Column('extra_data', sa.Text(), nullable=True),
        sa.Column('resource_type', sa.String(50), nullable=True),
        sa.Column('resource_id', sa.String(255), nullable=True),
        sa.Column('resource_name', sa.String(255), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for common queries
    op.create_index('ix_activity_logs_user_id', 'activity_logs', ['user_id'])
    op.create_index('ix_activity_logs_organization_id', 'activity_logs', ['organization_id'])
    op.create_index('ix_activity_logs_activity_type', 'activity_logs', ['activity_type'])
    op.create_index('ix_activity_logs_created_at', 'activity_logs', ['created_at'])

    # Composite indexes for common query patterns
    op.create_index('ix_activity_logs_org_created', 'activity_logs', ['organization_id', 'created_at'])
    op.create_index('ix_activity_logs_user_created', 'activity_logs', ['user_id', 'created_at'])
    op.create_index('ix_activity_logs_type_created', 'activity_logs', ['activity_type', 'created_at'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_activity_logs_type_created', table_name='activity_logs')
    op.drop_index('ix_activity_logs_user_created', table_name='activity_logs')
    op.drop_index('ix_activity_logs_org_created', table_name='activity_logs')
    op.drop_index('ix_activity_logs_created_at', table_name='activity_logs')
    op.drop_index('ix_activity_logs_activity_type', table_name='activity_logs')
    op.drop_index('ix_activity_logs_organization_id', table_name='activity_logs')
    op.drop_index('ix_activity_logs_user_id', table_name='activity_logs')

    # Drop table
    op.drop_table('activity_logs')
