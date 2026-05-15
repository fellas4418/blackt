# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parent.parent / "analysis.html"
text = p.read_text(encoding="utf-8")

old_kw_block_start = "            // 🔥 7대 원칙: 완벽한 단어 분할 & 중복 제거 로직\n            aiKeywordsObj = [];"
old_kw_block_end = "            keywordHtml += `<button class=\"kakao-btn voca-practice-cta-btn\""

start = text.index(old_kw_block_start)
end = text.index(old_kw_block_end)

new_kw = """            // 단어 리스트: worddata(마스터) + 시중 단어장 표제어(merged) — AI keywords 미사용
            aiKeywordsObj = buildDeterministicKeywordList(res);
            const keywordHtml = buildKeywordPanelHtml();

            """

text = text[:start] + new_kw + text[end:]

text = text.replace(
    '<motioniv class="result-content">${keywordHtml}</motioniv></motioniv>'.replace('motioniv', 'x'),
    'x',
)
text = text.replace(
    '<div class="result-content">${keywordHtml}</motioniv></div>'.replace('motioniv', 'x'),
    'x',
)
# fix keyword panel id
text = text.replace(
    '<span class="keyword-list-heading-main">주요 단어 리스트<br><span class="keyword-list-heading-sub">(내 학습 노트에 저장)</span></span></span></span><motioniv class="result-content">${keywordHtml}</motioniv></div>',
    'x',
)

old_card = (
    '<div class="result-card"><span class="result-label keyword-list-heading-label" style="color:#ff0055;">'
    '<span class="keyword-list-heading-row"><span class="keyword-list-heading-icon" aria-hidden="true">📚</span>'
    '<span class="keyword-list-heading-main">주요 단어 리스트<br><span class="keyword-list-heading-sub">(내 학습 노트에 저장)</span></span></span></span>'
    '<div class="result-content">${keywordHtml}</div></motioniv>'
)
if old_card not in text:
    old_card = (
        '<motioniv class="result-card"><span class="result-label keyword-list-heading-label" style="color:#ff0055;">'
    )
new_card = (
    '<div class="result-card"><span class="result-label keyword-list-heading-label" style="color:#ff0055;">'
    '<span class="keyword-list-heading-row"><span class="keyword-list-heading-icon" aria-hidden="true">📚</span>'
    '<span class="keyword-list-heading-main">주요 단어 리스트<br><span class="keyword-list-heading-sub">(내 학습 노트에 저장)</span></span></span></span>'
    '<div id="passage-keyword-panel" class="result-content">${keywordHtml}</div></div>'
)
if '<motioniv id="passage-keyword-panel"' not in text and 'id="passage-keyword-panel"' not in text:
    text = text.replace(
        '<span class="keyword-list-heading-main">주요 단어 리스트<br><span class="keyword-list-heading-sub">(내 학습 노트에 저장)</span></span></span></span><div class="result-content">${keywordHtml}</div></motioniv>',
        '<span class="keyword-list-heading-main">주요 단어 리스트<br><span class="keyword-list-heading-sub">(내 학습 노트에 저장)</span></span></span></span><div id="passage-keyword-panel" class="result-content">${keywordHtml}</div></div>',
    )
    if 'id="passage-keyword-panel"' not in text:
        text = text.replace(
            '<span class="keyword-list-heading-main">주요 단어 리스트<br><span class="keyword-list-heading-sub">(내 학습 노트에 저장)</span></span></span></span><div class="result-content">${keywordHtml}</div></motioniv>',
            '<span class="keyword-list-heading-main">주요 단어 리스트<br><span class="keyword-list-heading-sub">(내 학습 노트에 저장)</span></span></span></span><div id="passage-keyword-panel" class="result-content">${keywordHtml}</div></div>',
        )

hydrate_snip = "            try {\n                notifyPassageResultShownInHistory();\n            } catch (e) {}\n        }"
hydrate_new = "            try {\n                notifyPassageResultShownInHistory();\n            } catch (e) {}\n            void hydratePassageKeywordMeanings();\n        }"
if hydrate_snip in text and "void hydratePassageKeywordMeanings" not in text:
    text = text.replace(hydrate_snip, hydrate_new, 1)

# supplementFullWordMapFromDB - add cache after db
old_sup = """                        for (const s of stems) {
                            const db = findWordInDB(s);
                            if (db && db.kor) {
                                fullWordMapGlobal[tok] = db.kor;
                                break;
                            }
                        }"""
new_sup = """                        for (const s of stems) {
                            const db = findWordInDB(s);
                            if (db && db.kor) {
                                fullWordMapGlobal[tok] = db.kor;
                                break;
                            }
                            const cached = getPassageMeaningFromCache(s);
                            if (cached && cached.length) {
                                fullWordMapGlobal[tok] = formatMeaningsDisplay(cached);
                                break;
                            }
                        }"""
if old_sup in text:
    text = text.replace(old_sup, new_sup, 1)

# handleWordClick async
old_click_start = "        // 🔥 초정밀 어근 추출 및 무적 매칭 로직\n        window.handleWordClick = function(element, ev) {"
old_click_end = "            showWordPopup(rawWord, korMean, level);\n        };"

cs = text.index(old_click_start)
ce = text.index(old_click_end) + len(old_click_end)

new_click = r'''        // 지문 단어 클릭: worddata → 저장 뜻 → 단어장 리스트 → full_word_map → API 1회 생성
        window.handleWordClick = async function(element, ev) {
            if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
            if (window.sentencePickModeActive) return;
            const idiom = element.getAttribute('data-idiom');
            let rawWord = idiom ? idiom : String(element.innerText || '').toLowerCase().replace(/[^a-z-]/g, '').trim();
            if (!rawWord) return;

            const grammarExceptionMap = {
                "which": "관계대명사/의문사: 앞 명사를 이어받아 뒤 절이 그 명사를 설명할 때 '~한 …'으로 해석해요.",
                "that": "관계대명사/접속사: 문장을 연결하거나 명사를 보충 설명해요.",
                "who": "관계대명사: 앞의 '사람' 명사를 구체적으로 설명해 줘요.",
                "whom": "관계대명사(목적격): 설명하는 명사가 뒷문장의 목적어 역할을 해요.",
                "whose": "관계대명사(소유격): '~의'라는 소유의 의미로 앞 명사를 설명해요.",
                "where": "관계부사: 앞의 '장소' 명사를 문장으로 상세히 설명해요.",
                "when": "관계부사: 앞의 '시간' 명사를 문장으로 상세히 설명해요.",
                "why": "관계부사: 앞의 '이유' 명사를 문장으로 상세히 설명해요.",
                "how": "관계부사: '~하는 방식'의 의미로 문장을 이끌어요.",
                "such": "그런, 그러한"
            };

            if (grammarExceptionMap[rawWord]) {
                showWordPopup(rawWord, grammarExceptionMap[rawWord], "grammar");
                return;
            }
            if (rawWord === 'these') {
                showWordPopup('these', '복수 지시대명사: 이것들; 한정사: 이러한 (~명사)', 'grammar');
                return;
            }

            if (STOP_WORDS.has(rawWord)) {
                let result = resolveWordMeaningSync(rawWord);
                let korMean = result && result.mean ? result.mean : '';
                if (!korMean || korMean === 'undefined' || korMean === 'null') korMean = '';
                if (!korMean || korMean === '사전에서 찾을 수 없습니다.') {
                    korMean = STOP_WORD_CLICK_MEANINGS[rawWord] || '문맥에 따라 기능어(관사·전치사·접속사 등)로 쓰입니다.';
                }
                showWordPopup(rawWord, korMean, (result && result.lvl) ? result.lvl : 'other');
                return;
            }

            let result = resolveWordMeaningSync(rawWord);
            if (!result || !result.mean) {
                showWordPopup(rawWord, '뜻 불러오는 중…', 'other');
                result = await ensureWordMeaningFetched(rawWord);
            }
            let korMean = result && result.mean ? result.mean : '사전에서 찾을 수 없습니다.';
            if (korMean === 'undefined' || korMean === 'null') korMean = '사전에서 찾을 수 없습니다.';
            const level = result && result.lvl ? result.lvl : 'other';
            showWordPopup(rawWord, korMean, level);
        };'''

text = text[:cs] + new_click + text[ce:]

text = text.replace("temperature: 0.14", "temperature: 0.1")

p.write_text(text, encoding="utf-8")
print("analysis.html patched")
