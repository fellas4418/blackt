// wordData.js (테스트용 자동 생성 버전)

const wordsData = {
    middle: {},
    high: {}
};

// 1일 차부터 60일 차까지 테스트 단어를 자동으로 1개씩 생성하여 넣는 로직
for (let i = 1; i <= 60; i++) {
    // 주말(복습일) 여부와 상관없이 무조건 1개씩 단어 배정
    wordsData.middle[i] = [
        { 
            word: `M-Word ${i}`, 
            ipa: `/mɪdl-${i}/`, 
            meanings: [`중등 ${i}일 차 뜻`] 
        }
    ];

    wordsData.high[i] = [
        { 
            word: `H-Word ${i}`, 
            ipa: `/haɪ-${i}/`, 
            meanings: [`고등 ${i}일 차 뜻`] 
        }
    ];
}

/*
[현실적인 리스크 방지 안내]
나중에 진짜 단어 1,000개를 넣으실 때는 이 반복문 코드를 모두 지우고, 
아래와 같이 기존 JSON 형식으로 진짜 데이터를 덮어씌워 주셔야 합니다.

const wordsData = {
    middle: {
        1: [ { word: "Assume", ipa: "/əˈsuːm/", meanings: ["추정하다", "가정하다"] } ],
        2: [ { word: "Strategy", ipa: "/ˈstrætədʒi/", meanings: ["전략", "계획"] } ]
        // ... 생략 ...
    },
    high: {
        1: [ { word: "Arbitrary", ipa: "/ˈɑːrbɪtreri/", meanings: ["임의적인", "독단적인"] } ]
        // ... 생략 ...
    }
};
*/