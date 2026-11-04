// 바로 입장(손님)용 랜덤 닉네임: 형용사 + 동물 + 숫자 2자리 (예: 졸린너구리42, 2~10자). 서버가 정하고, 다시 연결할 때 같은 이름을 쓰려고 클라이언트가 돌려 보내도 이 모양일 때만 받음
export const GUEST_ADJ = ['졸린', '신난', '포근한', '느긋한', '반짝', '수줍은', '용감한', '엉뚱한', '말랑한', '따뜻한', '배고픈', '씩씩한', '깜찍한', '조용한', '명랑한', '든든한'];
export const GUEST_ANIMAL = ['고양이', '강아지', '토끼', '곰돌이', '다람쥐', '펭귄', '판다', '여우', '수달', '햄스터', '병아리', '오리', '사슴', '고래', '너구리', '코알라'];
const pick = (list, rand) => list[Math.floor(rand() * list.length)];
export const guestNick = (rand = Math.random, digits = 2) => pick(GUEST_ADJ, rand) + pick(GUEST_ANIMAL, rand) + String(Math.floor(rand() * 10 ** digits)).padStart(digits, '0');
const SHAPE = new RegExp(`^(${GUEST_ADJ.join('|')})(${GUEST_ANIMAL.join('|')})\\d{2,3}$`);
export const isGuestNick = (n) => typeof n === 'string' && SHAPE.test(n);
