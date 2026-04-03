import json
import os

FILES = {
    "middle": "중등 최종.txt",
    "high": "고등 최종.txt"
}
OUTPUT_FILE = 'worddata.js'
DAILY_NEW_COUNT = 30 

def process_file(file_path):
    if not os.path.exists(file_path):
        return {}
    
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        words = [line.strip() for line in f if line.strip() and not line.startswith('[')]
    
    word_pool = [{"word": w, "meanings": []} for w in words]
    scheduled_data = {}
    idx = 0
    week_num = 1
    
    while idx < len(word_pool):
        week_key = f"week{week_num}"
        scheduled_data[week_key] = {}
        week_words = []
        
        # Day 1 ~ 5: 신규 학습 (30개씩)
        for day in range(1, 6):
            daily_slice = word_pool[idx : idx + DAILY_NEW_COUNT]
            scheduled_data[week_key][str(day)] = daily_slice
            week_words.extend(daily_slice)
            idx += DAILY_NEW_COUNT
            if idx >= len(word_pool): break
            
        # Day 6 & 7: 2세션 학습 후 테스트 구조
        mid_point = len(week_words) // 2
        
        # Day 6: 전반부 복습 (학습용 2세션 분량 + 테스트용 전체)
        scheduled_data[week_key]["6"] = {
            "review_parts": [
                week_words[:mid_point // 2], # 세션 1
                week_words[mid_point // 2 : mid_point] # 세션 2
            ],
            "test": week_words[:mid_point] # Day 6 최종 테스트
        }
        
        # Day 7: 후반부 복습 (학습용 2세션 분량 + 테스트용 전체)
        scheduled_data[week_key]["7"] = {
            "review_parts": [
                week_words[mid_point : mid_point + (len(week_words)-mid_point)//2], # 세션 1
                week_words[mid_point + (len(week_words)-mid_point)//2 :] # 세션 2
            ],
            "test": week_words[mid_point:] # Day 7 최종 테스트
        }
        
        week_num += 1
    return scheduled_data

def main():
    final_data = {}
    for category, file_name in FILES.items():
        final_data[category] = process_file(file_name)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write("const wordsData = ")
        json.dump(final_data, f, indent=2, ensure_ascii=False)
        f.write(";") # 앱 호환성을 위해 export 문구 제거

    print(f"✅ 테스트 포함 로직 생성 완료: '{OUTPUT_FILE}'")

if __name__ == "__main__":
    main()