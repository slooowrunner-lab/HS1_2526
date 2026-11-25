import { QuestionSentenceAnalysis } from '../types/sentenceAnalysis';

export interface KeyFocusCardItem {
  id: string;
  term: string;
  meaningKo: string;
  hint?: string;
  tag: string;
}

export interface ParsedKeyFocus {
  strategySummary: string | null;
  cards: KeyFocusCardItem[];
}

const TRAILING_STRATEGY_SUFFIXES = [
  '등 일정 변경 단서 확인',
  '감정 전환 포착',
  '핵심 키워드 연결',
  '반복 어휘 파악',
  '핵심 지시어 추적',
  '두 가지 이점 종합',
  '전시 위치 통보 표현 확인',
  '구문 해석',
  '추이 파악',
  '대비 파악',
  '문구 확인',
  '정확 일치',
  '대응 어휘 찾기',
  '관점 전환 파악',
  '매매 방향 확인',
  '단서 확인',
  '표현 확인',
  '확인',
  '파악',
  '연결',
  '대비',
  '추론',
  '구분',
  '종합',
  '찾기',
  '판별',
  '추적',
  '포착',
];

// Concise Korean meanings for keyFocus English words/expressions across all 56 questions
const CONCISE_KO_MEANINGS: Record<string, string> = {
  delay: '연기하다, 지연',
  'originally scheduled': '원래 예정되었던',
  'reopen on may 1st': '5월 1일에 다시 문을 열다',
  'assigned table': '배정된 자리(테이블)',
  'number seven': '7번',
  'located near the entrance': '입구 근처에 위치한',
  'personal story or anecdote': '개인적인 이야기나 일화',
  'bonding with an audience': '청중과 유대감 쌓기',
  'identify with you': '당신에게 깊이 공감하다',
  'complement your spoken messages': '말로 전하는 메시지를 보완하다',
  'trap of over-gesturing': '과도한 몸짓의 함정',
  'balance is key': '균형이 핵심이다',
  'taste preferences can be changed throughout our lives':
    '입맛은 평생에 걸쳐 바뀔 수 있다',
  neuroplasticity: '신경가소성(뇌가 변하는 성질)',
  'repeated exposure': '반복적인 노출',
  'less about collecting pieces of knowledge than it is about reducing the uncertainties':
    '지식을 모으기보다 불확실성을 줄이는 것',
  'conformity is not spread equally across all age groups':
    '동조 현상은 모든 연령대에 똑같이 나타나지 않는다',
  'peak at 14': '14세에 정점을 찍다',
  decreases: '감소하다, 줄어들다',
  'need for relatedness': '관계 맺음에 대한 욕구',
  'caring relationship': '서로 보살피는 관계',
  'sense of connectedness to others': '타인과의 연결감',
  'temptation bundling': '유혹 묶기(하고 싶은 일+해야 할 일 결합)',
  'combines tempting habit with a habit people would like to build':
    '끌리는 습관과 기르고 싶은 습관을 묶다',
  'reading aloud': '소리 내어 읽기',
  'strengthens brainpower': '두뇌 힘을 길러주다',
  'develop public speaking skills': '발표(연설) 실력을 키우다',
  'jump with joy': '기뻐서 펄쩍 뛰다',
  cheered: '환호했다',
  fear: '두려움, 공포',
  froze: '얼어붙었다',
  'hid behind her mother': '엄마 뒤에 숨었다',
  'shaking with fear': '두려움에 떨다',
  laugh: '웃다',
  'feeling much better': '기분이 훨씬 나아지다',
  'feel at ease': '마음이 놓이다, 편안하다',
  'lower than': '~보다 더 낮은',
  'more than': '~보다 더 많은',
  'taught at carnegie mellon university from 1963 to 1974 before returning to university of chicago':
    '시카고대 복귀 전 1963~1974년 카네기멜런대 교수 재직',
  'never gave up playing the piano': '피아노 치기를 결코 포기하지 않았다',
  'purchase details': '구매 안내 사항',
  'online or at the city public parking offices':
    '온라인 또는 시 공영주차장 사무소에서',
  '4:30 p.m.': '오후 4시 30분',
  'last admission at 3:30 p.m.': '마지막 입장 오후 3시 30분',
  'how to apply: send us an e-mail': '지원 방법: 이메일 발송',
  'good ancestors': '훌륭한 조상(선조)',
  'seven generation stewardship': '7세대 후손까지 내다보는 책임 의식',
  'steal the shade': '그늘(미래 세대의 몫)을 빼앗다',
  'temptations to upgrade normal genes to superior versions':
    '보통 유전자를 우월하게 개량하려는 유혹',
  'slippery slope': '한번 발을 디디면 멈출 수 없는 위험한 경사길',
  accurate: '정확한',
  helps: '돕다 (단수/복수 수일치 확인)',
  designed: '설계된, 고안된',
  where: '~하는 곳 (관계부사)',
  that: '~하는 (관계대명사)',
  supplies: '공급하다, 제공하다',
  properly: '제대로, 적절하게',
  based: '~에 기반을 둔',
  what: '~하는 것 (관계대명사)',
  'to achieve': '달성하기 위해',
  however: '그러나 (앞뒤 내용 반전)',
  burden: '부담, 무거운 짐',
  same: '똑같은',
  opposite: '정반대의',
  'most likely to appreciate a good or service':
    '상품·서비스의 가치를 가장 잘 알아볼 만한',
  uninterested: '관심이 없는',
  interested: '관심이 있는',
  'too much stuff': '너무 많은 물건',
  'packed full': '빈틈없이 꽉 찬',
  'streamlining a play space': '놀이 공간을 간소하게 정리하기',
  'teaching materials': '수업·학습 자료',
  'teaching imaginary students': '가상의 학생들을 가르치기',
  'peer-teaching': '친구끼리 서로 가르치기',
  'adopting the teacher mindset': '가르치는 사람(선생님)의 마음가짐 갖기',
  'in other words': '다시 말해, 즉',
  'independent of whatever it is being used to count':
    '무엇을 세는 데 쓰이든 그 대상과 무관한',
  'not copying in order to learn ~ most efficiently':
    '가장 효율적으로 배우려고 따라 하는 것이 아니라',
  'in the proper way': '올바른(정석적인) 방식으로',
  'has no particular color, shape, or size': '특정한 색·모양·크기가 없다',
  'it has no physical form': '물리적인 형태가 없다',
  'simply reflect what you notice': '알아차린 것을 있는 그대로 비추다',
  'put an objective value on a subjective state of mind':
    '주관적 마음 상태에 객관적 수치를 매기다',
  'turn ~ emotional intensity into an objective number':
    '감정의 세기를 객관적인 숫자로 바꾸다',
  'knee-jerk survival actions': '본능적이고 반사적인 생존 행동',
  'main objective is to survive': '가장 큰 목표는 살아남는 것이다',
  'set point theory': '기준점 이론(일정 체중 유지 본능)',
  'this phrase': '이 어구(표현)',
  'these words': '이 말들',
  'radio receivers': '라디오 수신기',
  'their buttons': '그것들의 버튼',
  'american dream': '아메리칸 드림(미국적 성공의 꿈)',
  'this dream': '이 꿈',
  'these concerns': '이러한 걱정·우려들',
  yet: '하지만, 그럼에도',
  'the second visit': '두 번째 방문',
  'not a': 'A가 아니라',
  'rather, b': '오히려 B다',
  'a squirrel': '다람쥐 한 마리',
  'to do this': '이렇게 하기 위해',
  she: '그녀(다람쥐)',
  "this doesn't imply that squirrels lack concepts":
    '다람쥐에게 개념이 없다는 뜻은 아니다',
  'pressure on left knee released': '왼쪽 무릎에 가해진 압력이 풀림',
  'then drinks in ~ squeezes out': '그다음 빨아들이고 ~ 밖으로 짜내다',
  'this squeezing': '이러한 짜내는 작용',
  'those water glasses': '그 물컵들',
  'not innate/from adults': '타고나거나 어른에게 배운 것이 아님',
  'rather, self-constructed': '오히려 스스로 만들어 낸 것',
  'all this wisdom': '이 모든 지혜(전통 지식)',
  ignored: '무시된, 외면당한',
  'in this sense, ~ technology of forgetting': '이런 의미에서 망각의 기술',
  'safe environments': '안전한 환경',
  supportive: '지지해 주는, 도와주는',
  'lightly supervised': '가볍게 지켜보는',
  mild: '약한, 가벼운',
  'logical thinking': '논리적 사고',
  'creative thinking': '창의적 사고',
  'new/innovative solutions': '새롭고 혁신적인 해결책',
  'a lack of power': '힘이 부족한 상태',
  'a form of power': '진정한 힘의 한 형태',
  'to allow things to take the time they take':
    '일이 걸리는 시간을 자연스레 기다려 주기',
  feed: '먹이를 주다, 키우다 (문맥상 어색한 단어)',
  'do not account for': '~을 반영(설명)하지 못하다',
  'human beings with the tears wiped off': '눈물을 지워버린(감정이 빠진) 인간',
  'quantify with caution': '수치화할 때는 신중하라',
  'while ~': '~인 반면에',
  'saw the king preparing for a war': '왕이 전쟁 준비하는 모습을 보았다',
  'he sold his farm to his neighbor, victor':
    '그는 이웃 빅터에게 자신의 농장을 팔았다',
  victor: '빅터 (등장인물)',
  jack: '잭 (등장인물)',
};

function splitTopLevel(input: string, separators: string[]): string[] {
  const result: string[] = [];
  let current = '';
  let depth = 0;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (ch === '(' || ch === '[') depth += 1;
    if ((ch === ')' || ch === ']') && depth > 0) depth -= 1;

    let matchedSep: string | null = null;
    if (depth === 0) {
      for (const sep of separators) {
        if (input.startsWith(sep, i)) {
          matchedSep = sep;
          break;
        }
      }
    }

    if (matchedSep) {
      if (current.trim()) result.push(current.trim());
      current = '';
      i += matchedSep.length;
    } else {
      current += ch;
      i += 1;
    }
  }

  if (current.trim()) result.push(current.trim());
  return result;
}

function classifyTag(term: string, hint?: string): string {
  if (/^[①②③④⑤]/.test(term) || /\([A-Ea-e]\)/.test(term)) {
    return '어법 · 선택 단서';
  }
  if (/^[A-D]\(/.test(term) || /\([A-D]\)$/.test(term)) {
    return '순서 · 연결 단서';
  }
  if (hint && /비유|오류|반의어|부연|재진술|대조/.test(hint)) {
    return '핵심 포인트';
  }
  if (/\s/.test(term) && /[A-Za-z]/.test(term)) {
    return '핵심 표현';
  }
  if (/[A-Za-z]/.test(term)) {
    return '핵심 단어';
  }
  return '출제 단서';
}

function normalizeLookupKey(raw: string): string {
  return raw
    .replace(/^[①②③④⑤]\s*/, '')
    .replace(/\([A-Ea-e]\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function findConciseMeaning(
  term: string,
  hint: string | undefined,
  analysis?: QuestionSentenceAnalysis | null,
  footnotes?: { term: string; meaning: string }[],
): string {
  const key = normalizeLookupKey(term);

  // 1. Direct concise dictionary match
  if (CONCISE_KO_MEANINGS[key]) {
    return CONCISE_KO_MEANINGS[key];
  }

  // 2. Footnotes match if available
  if (footnotes && footnotes.length > 0) {
    for (const fn of footnotes) {
      const fnLower = fn.term.toLowerCase();
      if (key.includes(fnLower) || fnLower.includes(key)) {
        return fn.meaning;
      }
    }
  }

  // 3. Sentence analysis chunk match
  if (analysis && key.length >= 3) {
    for (const chunk of analysis.chunks) {
      const engLower = chunk.english.toLowerCase();
      if (engLower.includes(key) || key.includes(engLower)) {
        return chunk.meaningKo;
      }
    }
  }

  // 4. Partial match in dictionary keys for combined expressions
  for (const [dictKey, dictMeaning] of Object.entries(CONCISE_KO_MEANINGS)) {
    if (dictKey.length >= 4 && (key.includes(dictKey) || dictKey.includes(key))) {
      return dictMeaning;
    }
  }

  // 5. Parenthetical hint already contains Korean meaning/point
  if (hint && /[가-힣]/.test(hint)) {
    return hint;
  }

  // 6. If term itself has Korean explanation
  if (/[가-힣]/.test(term)) {
    return term;
  }

  return analysis?.modelTranslationKo
    ? `핵심 의미: ${analysis.coreMeaningKeywords.slice(0, 3).join(', ')}`
    : '지문 속 핵심 단서 표현';
}

export function parseKeyFocus(
  keyFocus: string,
  analysis?: QuestionSentenceAnalysis | null,
  footnotes?: { term: string; meaning: string }[],
): ParsedKeyFocus {
  const trimmed = keyFocus.trim();
  if (!trimmed) {
    return { strategySummary: null, cards: [] };
  }

  let strategySummary: string | null = null;
  let body = trimmed;

  // Extract leading strategy summary before top-level ' — ' if it looks like Korean summary
  const dashParts = splitTopLevel(trimmed, [' — ']);
  if (dashParts.length >= 2) {
    const first = dashParts[0];
    const hasKorean = /[가-힣]/.test(first);
    const mostlySummary =
      hasKorean &&
      !/[A-Za-z]{4,}/.test(first) &&
      !/^[①②③④⑤]/.test(first);
    if (mostlySummary) {
      strategySummary = first;
      body = dashParts.slice(1).join(' — ');
    }
  }

  // Split by top-level delimiters
  const rawTokens = splitTopLevel(body, [
    ' → ',
    ' vs. ',
    ', ',
    ' / ',
    ' + ',
    ' 및 ',
    ' — ',
  ]);

  const cards: KeyFocusCardItem[] = [];

  rawTokens.forEach((rawToken, idx) => {
    let token = rawToken.trim();
    if (!token) return;

    // Strip trailing Korean strategy suffix when attached to English tokens
    for (const suffix of TRAILING_STRATEGY_SUFFIXES) {
      const pattern = new RegExp(`\\s+${suffix}$`);
      if (pattern.test(token)) {
        const without = token.replace(pattern, '').trim();
        if (without.length >= 2) {
          if (!strategySummary) {
            strategySummary = suffix;
          }
          token = without;
          break;
        }
      }
    }

    // Separate trailing parenthetical hint if present: e.g. "accurate(보어 형용사)"
    let term = token;
    let hint: string | undefined;

    const parenMatch = token.match(/^(.+?)\(([^()]+)\)\s*(.*)$/);
    if (parenMatch) {
      const before = parenMatch[1].trim();
      const inside = parenMatch[2].trim();
      const after = parenMatch[3].trim();

      if (/^[A-D]$/.test(before) && /[A-Za-z]/.test(inside)) {
        term = inside;
        hint = `문단 (${before}) 연결 표현`;
      } else if (/^\([A-E]\)$/i.test(`(${inside})`)) {
        term = `${before} (${inside})${after ? ` ${after}` : ''}`.trim();
      } else if (before.length > 0) {
        term = after ? `${before} ${after}`.trim() : before;
        hint = inside;
      }
    }

    term = term.replace(/\s+등$/, '').trim();
    if (!term) return;

    const meaningKo = findConciseMeaning(term, hint, analysis, footnotes);

    cards.push({
      id: `kf-${idx}-${term.slice(0, 16)}`,
      term,
      meaningKo,
      hint: hint && hint !== meaningKo ? hint : undefined,
      tag: classifyTag(term, hint),
    });
  });

  // Fallback: if splitting yielded <= 1 card and analysis has useful chunks, add core chunk cards cleanly
  if (cards.length <= 1 && analysis && analysis.chunks.length > 0) {
    const existingLower = new Set(cards.map((c) => c.term.toLowerCase()));
    analysis.chunks
      .filter((ch) => ch.role !== 'CONJ' && ch.english.length >= 3)
      .slice(0, 3)
      .forEach((ch, idx) => {
        if (!existingLower.has(ch.english.toLowerCase())) {
          cards.push({
            id: `kf-chunk-${idx}-${ch.id}`,
            term: ch.english,
            meaningKo: ch.meaningKo,
            tag: '핵심 문장 조각',
          });
        }
      });
  }

  return {
    strategySummary,
    cards,
  };
}
