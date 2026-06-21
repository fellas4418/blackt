export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    // 1. 요청 데이터 추출 및 예외 처리
    const body = await request.json().catch(() => ({}));
    const { 
      passage, 
      analysis_type = "DEFAULT",
      exam_name = null,
      prob_no = null,
      prob_type = null
    } = body;
    
    if (!passage || passage.trim() === "") {
      return new Response(JSON.stringify({ error: "지문이 비어 있습니다." }), { 
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 2. 문법 카테고리 고정 틀 정의
    let systemInstruction = "";
    if (analysis_type === "DEFAULT" || analysis_type === "VERBS_ALL") {
      systemInstruction = `
영어 지문을 정밀 분석하여 다음 문법 카테고리에 해당하는 문장 구조를 찾아내세요:
1. '수여동사' (4형식 문장 구조)
2. '감각동사' (2형식 주격보어 구조 - look, smell, taste, sound, feel 등)
3. '사역동사' (5형식 목적격보어 구조 - make, have, let 및 준사역 help, get 등)
4. '감정동사' (사람의 감정을 유발하거나 느끼게 하는 동사 구조)
5. '5형식 동사' (사역/지각 제외하고 목적격 보어를 취하는 구조 - call, find, keep, consider, want 등)
6. '2형식 동사' (remain, stay, turn, become, seem 등 주격 보어를 취하는 상태/상태변화 유지 구조)
`;
    } else if (analysis_type === "GRAMMAR_ALL") {
      systemInstruction = "영어 지문에서 사역동사, 지각동사, 수여동사뿐만 아니라 관계대명사, 준동사 구조까지 모두 찾아 정밀 분석하세요.";
    } else {
      systemInstruction = `영어 지문에서 다음 분류에 맞춰 분석하세요: ${analysis_type}`;
    }

    // 3. D1 - passages 테이블 스키마 저장 (passage_text 반영)
    const passageInsert = await env.DB.prepare(
      "INSERT INTO passages (exam_name, prob_no, prob_type, passage_text, created_at) VALUES (?, ?, ?, ?, datetime('now')) RETURNING id"
    ).bind(
      exam_name,
      prob_no ? parseInt(prob_no, 10) : null,
      prob_type,
      passage
    ).first();

    if (!passageInsert || !passageInsert.id) {
      throw new Error("passages 테이블 저장에 실패했습니다.");
    }
    const passageId = passageInsert.id;

    // 4. Gemini API 호출 (최신 버전에 호환되는 규격인 gemini-2.5-flash 모델 사용)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `지문:\n${passage}` }] }],
        systemInstruction: {
          parts: [{ text: `${systemInstruction} 지문의 첫 번째 문장을 1번으로 하여 문장 번호를 매기세요.` }]
        },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                sentence_number: { type: "INTEGER" },
                word: { type: "STRING" },
                tag_class: { type: "STRING" },
                display_text: { type: "STRING" }
              },
              required: ["sentence_number", "word", "tag_class", "display_text"]
            }
          }
        }
      })
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      throw new Error(`Gemini API 오류: ${errText}`);
    }

    const geminiData = await geminiResponse.json();
    const aiResponseText = geminiData.candidates[0].content.parts[0].text;
    
    let analysisResults;
    try {
      analysisResults = JSON.parse(aiResponseText);
    } catch (e) {
      throw new Error("Gemini 응답을 파싱하는 중 오류가 발생했습니다.");
    }

    // 5. D1 - special_verbs 테이블 스키마에 맞춤 (sentence_no, target_word, tag_text 반영)
    if (analysisResults && analysisResults.length > 0) {
      const statements = analysisResults.map(item => {
        return env.DB.prepare(
          "INSERT INTO special_verbs (passage_id, sentence_no, target_word, tag_class, tag_text) VALUES (?, ?, ?, ?, ?)"
        ).bind(
          passageId,
          item.sentence_number || 0,
          item.word || "",
          item.tag_class || "",
          item.display_text || ""
        );
      });

      await env.DB.batch(statements);
    }

    return new Response(JSON.stringify({
      success: true,
      passage_id: passageId,
      analyzed_count: analysisResults.length,
      results: analysisResults
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }});
}
