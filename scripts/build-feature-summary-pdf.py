# -*- coding: utf-8 -*-
"""사라져 VOCA + AI 지문분석 기능 정리 PDF 생성"""
import os
from fpdf import FPDF

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "기타 참고, 마케팅 등", "홍보자료")
OUT_PDF = os.path.join(OUT_DIR, "기능정리_사라져VOCA_지문분석.pdf")

FONT_PATHS = [
    os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "Fonts", "malgun.ttf"),
    os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "Fonts", "malgunsl.ttf"),
    "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
]


def find_font():
    for p in FONT_PATHS:
        if p and os.path.isfile(p):
            return p
    raise FileNotFoundError("한글 폰트를 찾을 수 없습니다. Windows 맑은 고딕(malgun.ttf) 필요.")


class Pdf(FPDF):
    def __init__(self):
        super().__init__()
        self.font_path = find_font()
        self.add_font("K", "", self.font_path)
        self.add_font("K", "B", self.font_path)
        self.set_auto_page_break(auto=True, margin=18)

    def h1(self, text):
        self.set_font("K", "B", 16)
        self.set_text_color(0, 120, 180)
        self.multi_cell(0, 10, text)
        self.ln(2)

    def h2(self, text):
        self.set_font("K", "B", 12)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 8, text)
        self.ln(1)

    def h3(self, text):
        self.set_font("K", "B", 10)
        self.set_text_color(80, 80, 80)
        self.multi_cell(0, 7, text)

    def body(self, text):
        self.set_font("K", "", 9)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 5.5, text)

    def bullet(self, text):
        self.body("  • " + text)

    def table_row(self, col1, col2, bold_first=False):
        self.set_font("K", "B" if bold_first else "", 8)
        w1, w2 = 42, 148
        y0 = self.get_y()
        x0 = self.get_x()
        self.multi_cell(w1, 5, col1, border=0)
        y1 = self.get_y()
        self.set_xy(x0 + w1, y0)
        self.set_font("K", "", 8)
        self.multi_cell(w2, 5, col2, border=0)
        self.set_y(max(y1, self.get_y()))
        if self.get_y() > 270:
            self.add_page()


SECTIONS = [
    ("트리거 블랙 · 기능 정리", "h1"),
    ("사라져 VOCA · AI 지문 분석 (시험 분석 탭 제외)", "body"),
    ("", "sp"),
    ("1. 사라져 VOCA", "h1"),
    ("커리큘럼·진도", "h2"),
    ("table", [
        ("코스", "중등 1,200어 / 고등 2,000어"),
        ("기간 구조", "10주 · 70일 (주 5일 신규 + 토·일 주말)"),
        ("일일 진도", "Day 잠금/클리어, 하루 최대 3일치까지 진행"),
        ("주말(6·7일차)", "신규 단어 없음, 그 주 묶음·오답 복습만"),
    ]),
    ("하루 학습 루틴 (5+2)", "h2"),
    ("table", [
        ("평일 사이클", "5사이클/일"),
        ("주말 사이클", "2사이클/일 (주말 복습 모드)"),
        ("사이클당 흐름", "전 단어 블링크 2회전 → (3·5사이클) 4지선다 테스트"),
        ("테스트 시점", "3사이클, 5사이클(또는 주말 2사이클), 망각 차단 복습 중"),
        ("통과 기준", "테스트 80% 미만 → 「최후의 사이클」 강제"),
        ("사이클 사이", "3분 강제 쿨타임 + 푸시 알림"),
        ("당일 완료 후", "자유 복습 모드"),
    ]),
    ("블링크(사라져) 학습 — 단어 1개당", "h2"),
    ("table", [
        ("1·2회전", "단어 전체를 두 번 순회"),
        ("타이밍(약 9초)", "뜻 표시(약 5초) → 뜻 숨김(약 3초) → 뜻 재표시(약 2초)"),
        ("CHARGE UI", "진행 바·슬롯(1·2회전) 시각화"),
        ("TTS", "발음 재생(음소거 토글)"),
        ("테스트 모드", "5초 내 4지선다 선택"),
    ]),
    ("망각 차단(3일 누적)", "h2"),
    ("table", [
        ("선복습 대상", "2일 전 + 1일 전 오답·별표 단어"),
        ("진입 조건", "선복습 통과 후 당일 신규 진입"),
        ("표시", "「망각 차단 복습 진행 중」 등 단계 안내"),
    ]),
    ("오답·별표·재출제", "h2"),
    ("table", [
        ("오답", "테스트 틀리면 자동 수집·재출제"),
        ("별표", "학생 수동 표시 (맞혀도 유지, 직접 해제)"),
        ("모달", "Day별 클리어 리스트 / 오답·별표 리스트"),
        ("누적", "10주 완주 시 누적 오답 시험지"),
    ]),
    ("기록·리포트·인증", "h2"),
    ("table", [
        ("주간 PDF", "7일마다 마스터 단어장 PDF (오답·별표 표시)"),
        ("70일 리포트", "누적 학습 리포트"),
        ("카톡 공유", "학습 완료 칭찬 배지 + 공유 문구"),
        ("칭찬 배지 8종", "집중왕, 별빛복습왕, 목표불태우기, 성장로켓, 단단한루틴, 멀티성취러, 타깃헌터, 용기있는도전자"),
        ("학습 안내", "5대 시스템 모달 (블링크·쿨타임·3일복습·5+2·성취인증)"),
    ]),
    ("study.html 학습 화면", "h2"),
    ("table", [
        ("일시정지", "타이머·학습 중단"),
        ("체크포인트", "중단 시 이어하기 복원"),
        ("CHARGE", "충전형 진행 UI"),
    ]),
    ("지문 연동(커스텀 연습)", "h2"),
    ("table", [
        ("진입", "지문 분석 저장 단어 → 사라져 VOCA로 연습"),
        ("방식", "동일 블링크(5→3→2초), 2회전"),
        ("제외", "4지선다·일일 사이클·쿨타임 없음"),
        ("복귀", "분석 결과 화면으로 돌아가기"),
    ]),
    ("계정·앱", "h2"),
    ("table", [
        ("가입", "이름 + 휴대폰(010)"),
        ("PWA", "홈 화면 설치"),
        ("기록 복원", "쿠키·로컬 저장"),
    ]),
    ("", "sp"),
    ("2. AI 지문 분석", "h1"),
    ("분석 전 설정 (index → analysis)", "h2"),
    ("table", [
        ("학년", "중1·중2·중3·고1·고2·고3"),
        ("분석 대상", "내신 / 모의고사 / 교재·기타"),
        ("내신 세부", "1학기 중간·기말, 2학기 중간·기말"),
        ("모평 세부", "시행 연도 + 3·6·9·11월(수능)"),
        ("교재 세부", "교재명 직접 입력"),
        ("빠른 진입", "내 학습노트 빠른 복습 (문법/단어)"),
    ]),
    ("지문 입력 방식", "h2"),
    ("table", [
        ("실시간 촬영", "카메라 촬영"),
        ("갤러리", "기존 사진 선택"),
        ("텍스트", "복사·붙여넣기 분석"),
        ("지문 출처", "문항 번호·교재명 (비우면 AI 제목)"),
        ("OCR", "흔들림·작은 글씨 보정, 잘린 지문 제외"),
        ("다문항", "15.·16. 등 번호별 지문 분리"),
        ("기록", "이전 지문 분석 기록, 세션 복원"),
    ]),
    ("AI·데이터", "h2"),
    ("table", [
        ("모델", "Gemini 2.5 Flash"),
        ("문법 기준", "된다니까 3시간 영문법 체계 연계"),
        ("어휘 DB", "worddata + merged 시중어휘 매칭"),
    ]),
    ("리포트 구성 요소", "h2"),
    ("table", [
        ("full_translation", "문장별 영어 + 한국어 해석"),
        ("grammar", "문장·구문 단위 문법 포인트"),
        ("keywords", "핵심 어휘(단어장용)"),
        ("full_word_map", "지문 등장 단어 원형·뜻 전체"),
        ("background", "배경지식"),
        ("passage_layout", "유형별 전용 UI 레이아웃"),
        ("topic_keywords", "주제·요지형 결정 키워드 2~5개"),
        ("golden_key", "프리미엄 주제·키워드·주제문 3종"),
    ]),
    ("문제 유형 자동 판별 — 레이아웃", "h2"),
    ("table", [
        ("insertion", "문장삽입"),
        ("ordering", "순서배열"),
        ("grammar", "어법"),
        ("summary", "지문요약"),
        ("normal_clean", "빈칸 넣기(안내문·실용문)"),
    ]),
    ("문제 유형 — 키워드 추론", "h2"),
    ("body", "순서배열, 문장삽입, 어법, 문맥상 낱말의 쓰임, 밑줄친 말의 의미, 내용일치, 관계없는 문장, 지문요약, 가리키는 대상 구분, 글의 목적, 심경변화, 제목, 요지, 주장, 주제, 빈칸 넣기, 낱말의 의미"),
    ("유형별 UI 특징", "h2"),
    ("table", [
        ("문장삽입", "삽입 박스 문장 분리 표시"),
        ("순서배열", "(A)(B)(C) 단락, 인쇄 순서 유지"),
        ("지문요약", "하단 요약·빈칸 박스"),
        ("어법", "①~⑤ 틀린/교정, 보기별 reason"),
        ("공통", "문제지 인쇄 순서 유지(어법만 교정문 반영)"),
    ]),
    ("화면 조작·학습 UX", "h2"),
    ("table", [
        ("해석 가리기", "스스로 해석 연습"),
        ("주제문/키워드", "보기·끄기 토글"),
        ("G배지", "문법 배지 → 설명 박스 스크롤"),
        ("단어 탭", "뜻 팝업·저장"),
        ("VOCA CTA", "저장 단어 → 사라져 VOCA 연습"),
        ("문법 노트", "포인트별 저장"),
    ]),
    ("Golden Key (프리미엄)", "h2"),
    ("table", [
        ("topic_keywords", "주제 결정 핵심 키워드"),
        ("주제 요약", "easy + formal 톤"),
        ("topic_variants", "실제주제 / 동의어변형 / 구조변형 (3종)"),
        ("권한", "is_premium · tri3 초대코드 · 관리자"),
    ]),
    ("AI 질문 (프리미엄)", "h2"),
    ("table", [
        ("문장 선택", "막힌 문장 지정 후 질문"),
        ("일반 질문", "자유 질문"),
        ("기록", "chat_history 서버 저장"),
        ("체험", "aiDemo (비유료 제한)"),
    ]),
    ("학습 노트·동기화", "h2"),
    ("table", [
        ("문법 노트", "저장 grammar 포인트 목록"),
        ("단어 노트", "저장 지문 어휘 목록"),
        ("동기화", "saved_grammar, saved_voca 클라우드"),
    ]),
    ("무료 / 유료 (지문)", "h2"),
    ("table", [
        ("무료", "해석·문법·단어·배경·유형 UI·노트 동기화·이전 기록"),
        ("유료", "Golden Key, AI 질문·질문 기록"),
    ]),
    ("연계", "h2"),
    ("table", [
        ("3시간 영문법", "문법 약점 보완 CTA"),
        ("tri3 결제", "프리미엄 해제"),
    ]),
    ("", "sp"),
    ("— 내부·홍보용 · 트리거 블랙 —", "body"),
]


def build():
    os.makedirs(OUT_DIR, exist_ok=True)
    pdf = Pdf()
    pdf.add_page()
    pdf.set_margins(15, 15, 15)

    for item in SECTIONS:
        if len(item) == 2:
            kind, payload = item
        else:
            continue
        if kind == "sp":
            pdf.ln(4)
            continue
        if kind == "h1":
            pdf.h1(payload)
        elif kind == "h2":
            pdf.ln(3)
            pdf.h2(payload)
        elif kind == "h3":
            pdf.h3(payload)
        elif kind == "body":
            pdf.body(payload)
            pdf.ln(1)
        elif kind == "table":
            pdf.set_draw_color(220, 220, 220)
            for i, (c1, c2) in enumerate(payload):
                pdf.table_row(c1, c2, bold_first=True)
                if i < len(payload) - 1:
                    pdf.set_draw_color(240, 240, 240)
                    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
            pdf.ln(2)

    pdf.output(OUT_PDF)
    print("OK:", OUT_PDF)


if __name__ == "__main__":
    build()
