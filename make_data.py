import json
import os

# 설정값 (파일명이 다르면 여기서 수정하세요)
FILES = {
    "middle": "중등 최종.txt", 
    "high": "고등 최종.txt"
}
OUTPUT_FILE = 'worddata.js'
DAILY_NEW_COUNT = 30 

def process_file(file_path):
    if not os.path.exists(file_path):
        print(f"경고: {file_path} 파일이 없어 해당 데이터는 건너뜁니다.")
        return []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        # [source] 등 메타데이터 제외하고 단어만 추출
        words = [line.strip() for line in f if line.strip() and not line.startswith('[')]
    
    word_pool = [{"word": w, "meanings": []} for w in words]
    
    scheduled_data = {}
    idx = 0
    week_num = 1
    
    while idx < len(word_pool):
        week_key = f"week{week_num}"
        scheduled_data[week_key] = {}
        week_words = []
        
        # Day 1 ~ 5: 신규 학습
        for day in range(1, 6):
            daily_slice = word_pool[idx : idx + DAILY_NEW_COUNT]
            scheduled_data[week_key][str(day)] = daily_slice
            week_words.extend(daily_slice)
            idx += DAILY_NEW_COUNT
            if idx >= len(word_pool): break
            
        # Day 6 ~ 7: 복습 (원장님 요청대로 2회 세션용 절반 분할)
        mid_point = len(week_words) // 2
        scheduled_data[week_key]["6"] = week_words[:mid_point] # 1~2.5일치 분량
        scheduled_data[week_key]["7"] = week_words[mid_point:] # 2.5~5일치 분량
        
        week_num += 1
        
    return scheduled_data

def main():
    final_data = {}
    
    for category, file_name in FILES.items():
        print(f"{category} 데이터 처리 중...")
        final_data[category] = process_file(file_name)
    
    # .js 파일 생성
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write("const wordsData = ")
        json.dump(final_data, f, indent=2, ensure_ascii=False)
        f.write(";\n\nexport default wordsData;")
        
    print(f"\n✅ 통합 완료: '{OUTPUT_FILE}' 파일이 생성되었습니다.")

if __name__ == "__main__":
    main()