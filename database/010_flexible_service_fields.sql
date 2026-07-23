ALTER TABLE services
  ADD COLUMN IF NOT EXISTS field_schema JSONB NOT NULL DEFAULT
  '[{"key":"email","label":"الإيميل","type":"email","required":true},{"key":"password","label":"كلمة المرور","type":"password","required":true},{"key":"otpSecret","label":"مفتاح OTP","type":"text","required":false},{"key":"otpUrl","label":"رابط استخراج OTP","type":"url","required":false}]'::jsonb;

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS custom_data JSONB NOT NULL DEFAULT '{}'::jsonb;
