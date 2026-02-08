-- メンエスインデクサ サンプルスキーマ
-- esthe-ranking.jp から取得可能な情報に基づく

-- 都道府県マスタ
CREATE TABLE prefecture (
    prefecture_id INTEGER PRIMARY KEY,  -- 都道府県コード (13=東京, 40=福岡)
    prefecture_name TEXT NOT NULL,      -- "東京都"
    prefecture_slug TEXT NOT NULL       -- "tokyo"
);

-- サンプルデータ
INSERT INTO prefecture VALUES (13, '東京都', 'tokyo');
INSERT INTO prefecture VALUES (14, '神奈川県', 'kanagawa');
INSERT INTO prefecture VALUES (27, '大阪府', 'osaka');
INSERT INTO prefecture VALUES (40, '福岡県', 'fukuoka');

-- エリアマスタ
CREATE TABLE area (
    area_id INTEGER PRIMARY KEY AUTOINCREMENT,
    area_name TEXT NOT NULL,            -- "恵比寿"
    area_slug TEXT NOT NULL,            -- "ebisu"
    prefecture_id INTEGER NOT NULL,     -- FK → prefecture
    salon_count INTEGER,                -- 74 (参考値)
    source_url TEXT,                    -- "https://www.esthe-ranking.jp/ebisu/"
    FOREIGN KEY (prefecture_id) REFERENCES prefecture(prefecture_id)
);

-- サンプルデータ
INSERT INTO area (area_name, area_slug, prefecture_id, salon_count, source_url) VALUES
    ('恵比寿', 'ebisu', 13, 74, 'https://www.esthe-ranking.jp/ebisu/'),
    ('渋谷', 'shibuya', 13, 65, 'https://www.esthe-ranking.jp/shibuya/'),
    ('新宿', 'shinjuku', 13, 120, 'https://www.esthe-ranking.jp/shinjuku/'),
    ('博多', 'hakata', 40, 45, 'https://www.esthe-ranking.jp/hakata/');

-- サロン
CREATE TABLE salon (
    salon_id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT,                     -- esthe-ranking UUID "a9d34bfc-aa35-..."
    salon_name TEXT NOT NULL,           -- "Vicca+plus."
    salon_type TEXT,                    -- "メンエス" / "アジアン"
    business_type TEXT,                 -- "店舗" / "派遣"
    access TEXT,                        -- "恵比寿駅東口徒歩5分"
    business_hours TEXT,                -- "09:30～翌05:00"
    reception_hours TEXT,               -- "7:30～"
    base_price INTEGER,                 -- 16000
    base_duration INTEGER,              -- 70 (分)
    phone TEXT,                         -- "080-9711-4911"
    official_url TEXT,                  -- "https://viccaplus.net/"
    domain TEXT,                        -- "viccaplus.net" (重複チェック用)
    therapist_count_portal INTEGER,     -- esthe-ranking の数字（累計/参考）
    therapist_count_official INTEGER,   -- 公式サイトの数字（現在籍）
    description TEXT,                   -- 説明文
    service_tags TEXT,                  -- "アロマ,リンパ,完全個室" (カンマ区切り)
    image_url TEXT,                     -- "/uploads/shop-xxx.jpg"
    source TEXT DEFAULT 'esthe-ranking', -- データ取得元
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- サンプルデータ
INSERT INTO salon (source_id, salon_name, salon_type, business_type, access, business_hours, base_price, base_duration, phone, official_url, domain, therapist_count_portal, therapist_count_official, description, service_tags) VALUES
    ('a9d34bfc-aa35-4308-8c73-81d6b3a14eca', 'Vicca+plus.', 'メンエス', '店舗', '恵比寿駅東口徒歩5分', '09:30～翌05:00', 16000, 70, '080-9711-4911', 'https://viccaplus.net/', 'viccaplus.net', 55, NULL, '完全予約制のメンズサロンです', 'アロマ,リンパ,ホットオイル,完全個室'),
    ('b44e2367-4edf-4fed-8947-da2dcbd10174', 'SWEET MIST恵比寿', 'メンエス', '店舗', '恵比寿駅・広尾駅', '11:00～翌05:00', 16000, 90, '050-3627-7030', 'https://sweetmist.jp/', 'sweetmist.jp', 67, NULL, 'S1専属グラドル在籍', 'アロマ,オイル,リンパ,パウダー'),
    ('b41f8c58-a252-4f32-98c1-355239f65e5a', 'リンダスパ恵比寿', 'メンエス', '店舗', '恵比寿駅・中目黒駅', '11:00～翌05:00', 15000, 70, '080-4076-3741', 'https://lindaspa.jp/', 'lindaspa.jp', 182, NULL, '極上セラピストのみを厳選', 'アロマ,リンパ,ワンルーム');

-- サロン×エリア（中間テーブル）
CREATE TABLE salon_area (
    salon_id INTEGER NOT NULL,
    area_id INTEGER NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,   -- メインの所在地か
    area_rank INTEGER,                  -- エリア内ランキング順位
    PRIMARY KEY (salon_id, area_id),
    FOREIGN KEY (salon_id) REFERENCES salon(salon_id),
    FOREIGN KEY (area_id) REFERENCES area(area_id)
);

-- サンプルデータ（リンダスパは恵比寿と中目黒の両方に紐づく例）
INSERT INTO salon_area VALUES (1, 1, TRUE, 1);   -- Vicca → 恵比寿(1位)
INSERT INTO salon_area VALUES (2, 1, TRUE, 2);   -- SWEET MIST → 恵比寿(2位)
INSERT INTO salon_area VALUES (3, 1, TRUE, 3);   -- リンダスパ → 恵比寿(3位)
INSERT INTO salon_area VALUES (3, 2, FALSE, 5);  -- リンダスパ → 渋谷にも(5位)
