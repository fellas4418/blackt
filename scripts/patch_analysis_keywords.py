# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parent.parent / "analysis.html"
text = p.read_text(encoding="utf-8")
start = text.index("        function buildKeywordPanelHtml() {")
end = text.index("        function robustSearchMap(word) {")

new_fn = r'''        function buildKeywordPanelHtml() {
            const savedVocaList = savedVocaCache;
            let keywordHtml = '<motioniv style="display:flex; justify-content:flex-end; align-items:center; margin-bottom:12px;">' +
                '<button id="save-all-btn" class="kw-save-btn" onclick="saveAllKeywords()">전체 저장</button></motioniv>';
            keywordHtml = keywordHtml.replace(/motioniv/g, 'div');
            const vocaItemsArray = [];
            if (aiKeywordsObj.length > 0) {
                aiKeywordsObj.forEach(kw => {
                    if (!kw.eng) return;
                    const isSaved = savedVocaList.some(item => String(item.eng || '').toLowerCase() === String(kw.eng).toLowerCase());
                    const btnClass = isSaved ? 'kw-save-btn active' : 'kw-save-btn';
                    const btnText = isSaved ? '✅' : '저장';
                    const safeEng = String(kw.eng || '').replace(/'/g, "\\'");
                    const safeKor = String(kw.kor || '').replace(/'/g, "\\'");
                    const levelTag = kw.level === 'middle' ? '<span class="kw-tag kw-mid">중등</span>' :
                        kw.level === 'high' ? '<span class="kw-tag kw-high">고등</span>' :
                            '<span class="kw-tag kw-other">기타</span>';
                    vocaItemsArray.push(
                        '<div class="kw-container"><div class="kw-body">' + levelTag +
                        '<strong style="color:#fff; font-size:1.05rem; cursor:pointer;" onclick="showWordPopup(\'' + safeEng + '\', \'' + safeKor + '\', \'' + kw.level + '\')">' + kw.eng + '</strong> ' +
                        '<span style="color:#aaa; font-size:0.9rem; margin-left:6px;">' + kw.kor + '</span></div>' +
                        '<button id="btn-kw-' + kw.eng + '" class="' + btnClass + '" onclick="toggleVocaSave(\'' + safeEng + '\', \'' + safeKor + '\', \'' + kw.level + '\', this)">' + btnText + '</button></div>'
                    );
                });
                if (vocaItemsArray.length > 3) {
                    keywordHtml += vocaItemsArray.slice(0, 3).join('');
                    keywordHtml += '<div id="voca-more-list" style="display:none;">' + vocaItemsArray.slice(3).join('') + '</div>';
                    keywordHtml += '<button id="voca-toggle-btn" onclick="toggleVocaList()" style="width:100%; background:transparent; border:1px solid #444; color:#aaa; padding:10px; border-radius:8px; margin-top:10px; font-size:0.85rem; cursor:pointer;">전체 단어 보기 ▼</button>';
                } else {
                    keywordHtml += vocaItemsArray.join('');
                }
            } else {
                keywordHtml += '<div style="color:#888;">추출된 주요 단어가 없습니다.</div>';
            }
            keywordHtml += '<button class="kakao-btn voca-practice-cta-btn" style="background:var(--neon-green); color:#000; margin-top:15px;" onclick="startVocaPractice()"><span class="voca-cta-line1"><span class="voca-cta-text-wrap"><span class="voca-cta-ico" aria-hidden="true">👉</span><span class="voca-cta-text">사라져 VOCA로</span></span></span><span class="voca-cta-line2">나만의 단어 연습하기</span></button>';
            return keywordHtml;
        }

        async function hydratePassageKeywordMeanings() {
            const pending = aiKeywordsObj
                .filter(k => k && k.eng && (!k.kor || k.kor === '…'))
                .map(k => k.eng);
            if (!pending.length) return;
            try {
                await fetchWordMeaningsFromApi(pending);
            } catch (e) {
                return;
            }
            aiKeywordsObj.forEach(kw => {
                if (!kw || !kw.eng || (kw.kor && kw.kor !== '…')) return;
                const hit = resolveWordMeaningSync(kw.eng);
                if (hit && hit.mean) {
                    kw.kor = hit.mean;
                    kw.level = hit.lvl || kw.level;
                }
            });
            const panel = document.getElementById('passage-keyword-panel');
            if (panel) panel.innerHTML = buildKeywordPanelHtml();
            checkAllSavedStatus();
        }

'''

text = text[:start] + new_fn + text[end:]
p.write_text(text, encoding="utf-8")
print("ok")
