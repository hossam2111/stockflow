INSERT INTO inventory_items(id,organization_id,service_id,email,password,otp_secret,otp_url,account_type,max_usage,current_usage,status,expiry_date)
SELECT 'DEMO-PA-'||LEFT(s.organization_id,8)||'-'||v.n,s.organization_id,s.id,v.email,'Demo@StockFlow2026','JBSWY3DPEHPK3PXP','https://2fa.live/tok/JBSWY3DPEHPK3PXP',v.kind,v.capacity,v.used,CASE WHEN v.used>=v.capacity THEN 'FULL' ELSE 'AVAILABLE' END,'2026-12-31'
FROM services s CROSS JOIN (VALUES
('1','shared-team-01@demo.stockflow.app','SHARED',5,0),('2','shared-team-02@demo.stockflow.app','SHARED',5,2),('3','shared-agency@demo.stockflow.app','SHARED',10,4),
('4','individual-01@demo.stockflow.app','INDIVIDUAL',1,0),('5','individual-02@demo.stockflow.app','INDIVIDUAL',1,0),('6','individual-03@demo.stockflow.app','INDIVIDUAL',1,0)
) AS v(n,email,kind,capacity,used) WHERE s.name='Pro Apps' ON CONFLICT DO NOTHING;
