CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  withdrawal_id TEXT UNIQUE REFERENCES withdrawals(id) ON DELETE SET NULL,
  created_by TEXT REFERENCES users(id),
  source TEXT NOT NULL DEFAULT 'MANUAL',
  service_name TEXT,
  item_description TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_amount INTEGER NOT NULL DEFAULT 0,
  cost_amount INTEGER NOT NULL DEFAULT 0,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  notes TEXT,
  sold_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sales_org_sold_idx ON sales(organization_id,sold_at DESC);
INSERT INTO sales(id,organization_id,withdrawal_id,created_by,source,service_name,item_description,customer_name,customer_phone,quantity,total_amount,cost_amount,paid_amount,status,notes,sold_at,created_at)
SELECT 'SALE-'||w.id,w.organization_id,w.id,w.user_id,'WITHDRAWAL',s.name,s.name,COALESCE(NULLIF(w.customer_name,''),'عميل'),w.customer_phone,1,COALESCE(w.selling_price,0),COALESCE(w.cost,0),COALESCE(w.paid_amount,0),CASE WHEN w.status='RETURNED' THEN 'CANCELLED' ELSE 'COMPLETED' END,w.customer_notes,w.created_at::date,w.created_at
FROM withdrawals w JOIN services s ON s.id=w.service_id ON CONFLICT(withdrawal_id) DO NOTHING;
