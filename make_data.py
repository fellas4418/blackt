import json
import os

# 1. 띄어쓰기 교정 로직 복구
PHRASES_TO_FIX = {
    "takecareof": "take care of", "apartfrom": "apart from", "farfrom": "far from",
    "asto": "as to", "byfar": "by far", "callfor": "call for",
    "comeacross": "come across", "comeupwith": "come up with", "consistof": "consist of",
    "makeup": "make up", "endup": "end up", "freeof": "free of",
    "getridof": "get rid of", "handin": "hand in", "athand": "at hand",
    "inadvance": "in advance", "inadditionto": "in addition to", "intermsof": "in terms of",
    "regardlessof": "regardless of", "passaway": "pass away", "bringabout": "bring about"
}

def clean_word(w):
    w = w.lower().replace(" ", "")
    return PHRASES_TO_FIX.get(w, w)

# 2. 임시 뜻 DB (실제로는 방대한 DB가 필요함)
MEANING_DB = {
    "ability": "능력", "allow": "허용하다", "amaze": "놀라게 하다", "ancient": "고대의",
    "adversary": "상대방, 적수", "benevolence": "자비심, 박애", "deference": "존중, 경의",
    "eloquence": "웅변, 설득력", "frivolous": "경솔한", "perpetuate": "영속시키다",
    "impetuous": "성급한", "kinship": "친족 관계", "vibrant": "활기찬"
}

FILES = {
    "middle": "중등 최종.txt",
    "high": "고등 최종.txt"
}
OUTPUT_FILE = 'worddata.js'
DAILY_NEW_COUNT = 30

def get_meaning(word):
    # 단어 뜻 매핑: 없으면 누락 방지를 위해 임시 텍스트 반환
    return MEANING_DB.get(word.lower(), "뜻 확인 필요")

def process_file(file_path):
    if not os.path.exists(file_path): return {}
    
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = [line.strip() for line in f if line.strip()]
    
    unique_words = []
    seen = set()
    for w in lines:
        cleaned = clean_word(w) # 교정 로직 적용
        if cleaned not in seen:
            unique_words.append(cleaned)
            seen.add(cleaned)
            
    word_pool = [{"word": w, "meanings": [get_meaning(w)]} for w in unique_words]
    
    scheduled_data = {}
    idx = 0
    week_num = 1
    
    while idx < len(word_pool):
        week_key = f"week{week_num}"
        scheduled_data[week_key] = {}
        week_words = []
        
        for day in range(1, 6):
            daily_slice = word_pool[idx : idx + DAILY_NEW_COUNT]
            scheduled_data[week_key][str(day)] = daily_slice
            week_words.extend(daily_slice)
            idx += DAILY_NEW_COUNT
            if idx >= len(word_pool): break
            
        mid = len(week_words) // 2
        scheduled_data[week_key]["6"] = {
            "review_parts": [week_words[:mid//2], week_words[mid//2:mid]],
            "test": week_words[:mid]
        }
        scheduled_data[week_key]["7"] = {
            "review_parts": [week_words[mid:mid+(len(week_words)-mid)//2], week_words[mid+(len(week_words)-mid)//2:]],
            "test": week_words[mid:]
        }
        week_num += 1
    return scheduled_data

def main():
    final_data = {}
    for cat, f_name in FILES.items():
        final_data[cat] = process_file(f_name)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write("const wordsData = ")
        json.dump(final_data, f, indent=2, ensure_ascii=False)
        f.write(";")
    print(f"✅ 구조 및 뜻 매핑 완료: {OUTPUT_FILE} 생성됨")

if __name__ == "__main__":
    main()