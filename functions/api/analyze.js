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

    // 2. 가변 프롬프트 처리
    let systemInstruction = "";
    if (analysis_type === "GRAMMAR_ALL") {
      systemInstruction = "영어 지문에서 사역동사, 지각동사, 수여동사뿐만 아니라 관계대명사, 준동사 구조까지 모두 찾아 정밀 분석하세요.";
    } else {
      systemInstruction = "영어 지문에서 '사역동사', '지각동사', '수여동사' 등 특수동사 구조가 쓰인 문장을 찾아 정밀하게 분석하세요.";
    }

    // 3. D1 - passages 테이블 스키마 정합성 맞춤 (passage_text 및 모의고사 정보 컬럼 반영)
    const passageInsert = await env.DB.prepare(
      "INSERT INTO passages (exam_name, prob_no, prob_type, passage_text, created_at) VALUES (?, ?, ?, ?, datetime('now')) RETURNING id"
    ).bind(
      exam_name,
      prob_no,
      prob_no ? parseInt(prob_no, 10) : null, // 정수형 변환 처리 리스크 방지
      passage
    ).first();

    if (!passageInsert || !passageInsert.id) {
      throw new Error("passages 테이블 저장에 실패했습니다.");
    }
    const passageId = passageInsert.id;

    // 4. Gemini API 호출 + 엄격한 JSON 스키마 강제
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
    
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

    // 5. D1 - special_verbs 테이블 Bulk Insert (안전한 트랜잭션 처리)
    if (analysisResults && analysisResults.length > 0) {
      const statements = analysisResults.map(item => {
        return env.DB.prepare(
          "INSERT INTO special_verbs (passage_id, sentence_number, word, tag_class, display_text, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
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
