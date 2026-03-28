-- 1. 建立住宿資料表 (Accommodations)
CREATE TABLE accommodations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('airbnb', 'resort')),
  link TEXT,
  image_url TEXT,
  features TEXT[] -- 存放特色描述
);

-- 2. 建立使用者資料表 (Users) - 存放 8 位成員
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  key TEXT NOT NULL -- 用於身份識別的 4 位數密鑰
);

-- 3. 建立投票紀錄表 (Votes)
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  accommodation_id UUID REFERENCES accommodations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, accommodation_id) -- 確保同一人對同一飯店只能投一票
);

-- 4. 插入初始住宿資料 (依據你的連結整理)
INSERT INTO accommodations (name, type, link, image_url, features) VALUES
('p22 中天精選別墅', 'airbnb', 'https://www.airbnb.com.tw/rooms/1349239359065687878', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80', ARRAY['4間臥室', '5間衛浴', '多人入住首選']),
('Mövenpick 奢華 6 房泳池別墅', 'airbnb', 'https://www.airbnb.com.tw/rooms/1338763244250097181', 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=80', ARRAY['2025新房源', '6房7床', '容納16人以上']),
('中天海灘 50 米豪華別墅', 'airbnb', 'https://www.airbnb.com.tw/rooms/1410719493045136394', 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=800&q=80', ARRAY['離海50公尺', '近中天夜市', '住滿3晚送接機']),
('達拉海角五星級海濱度假村', 'resort', 'https://capedarapattaya.com/zh-hans/', 'https://images.unsplash.com/photo-1439130490301-25e322d88054?auto=format&fit=crop&w=800&q=80', ARRAY['私有沙灘', '全海景房', '五星級飯店服務']),
('聖塔拉幻影水上樂園度假村', 'resort', 'https://www.centarahotelsresorts.com/centaragrand/cn/cmbr', 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80', ARRAY['大型水上樂園', '主題度假村', '適合熱鬧慶祝']),
('Oceanphere 高級私人泳池別墅', 'resort', 'https://www.booking.com/hotel/th/x2-pattaya-oceanphere-residence.zh-tw.html', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80', ARRAY['私人泳池別墅', 'Elite Suites 管理', '隱私度極高']);

-- 5. 插入 8 位使用者並生成隨機 Key (假設隨機 4 位數)
INSERT INTO users (name, key) VALUES
('Evan', 'E821'),
('Johnshon', 'J402'),
('Steven', 'S559'),
('Sunny', 'N221'),
('Jeffrey', 'Y883'),
('Tsim', 'T110'),
('Wayne', 'W774'),
('Tom', 'M932');

-- 6. 設定 Row Level Security (RLS) - 暫時設為寬鬆以利開發測試
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Access" ON votes FOR SELECT USING (true);
CREATE POLICY "Public Insert Access" ON votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Delete Access" ON votes FOR DELETE USING (true);
CREATE POLICY "Public Read Access Accommodations" ON accommodations FOR SELECT USING (true);
CREATE POLICY "Public Read Access Users" ON users FOR SELECT USING (true);
