import json

def build_structure(file_path, per_day):
    with open(file_path, 'r', encoding='utf-8') as f:
        # 유효한 단어 라인만 추출
        lines = [line.strip() for line in f if '|' in line]
    
    # 70일(10주) 분량의 빈 구조 생성
    result = {}
    for w in range(1, 11):
        result[f"week{w}"] = {}
        for d in range(1, 8):
            result[f"week{w}"][str(d)] = []

    # 단어 데이터 배정
    total_words = len(lines)
    word_idx = 0
    
    for w in range(1, 11):
        week_words = [] # 주간 복습용 누적 배열
        # Day 1 ~ 5: 신규 단어 배정
        for d in range(1, 6):
            day_list = []
            for _ in range(per_day):
                if word_idx < total_words:
                    word, mean = lines[word_idx].split('|')
                    word_obj = {"word": word.strip(), "meanings": [mean.strip()]}
                    day_list.append(word_obj)
                    week_words.append(word_obj)
                    word_idx += 1
            result[f"week{w}"][str(d)] = day_list
        
        # Day 6 ~ 7: 주간 복습 및 테스트 세팅 (app.js 로직 호환)
        half = len(week_words) // 2
        review_data = {
            "test": week_words,
            "review_parts": [week_words[:half], week_words[half:]]
        }
        result[f"week{w}"]["6"] = review_data
        result[f"week{w}"]["7"] = review_data
        
    return result

# 실행 및 통합 저장
final_data = {
    "middle": build_structure('voca_middle.txt', 24),
    "high": build_structure('voca_high.txt', 40)
}

with open('worddata.js', 'w', encoding='utf-8') as f:
    f.write(f"const wordsData = {json.dumps(final_data, ensure_ascii=False, indent=2)};")

print("✅ [사라져 Voca] 전용 worddata.js 생성 완료!")