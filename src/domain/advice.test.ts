import { describe, expect, it } from 'vitest';
import { adviceToText, checkAdviceContent, groupByLevel } from './advice';

const good = {
  summary: 'たんぱく質が足りていません',
  categories: [
    { category: 'fish', level: 'recommend', reason: 'たんぱく質を補える' },
    { category: 'meat', level: 'ok', reason: '脂質にまだ余裕' },
    { category: 'fried', level: 'limit', reason: '' },
  ],
  menus: [{ label: '案1', dishes: ['鮭の塩焼き', 'ほうれん草のおひたし'] }],
  points: ['塩分は控えめに'],
};

describe('checkAdviceContent', () => {
  it('正しい回答はそのまま受け取る', () => {
    const r = checkAdviceContent(good);
    expect(r).toEqual(good);
  });

  it('知らない種類・おすすめ度、重なった種類は捨てる', () => {
    const r = checkAdviceContent({
      ...good,
      categories: [
        { category: 'pizza', level: 'ok', reason: '' },
        { category: 'fish', level: 'maybe', reason: '' },
        { category: 'fish', level: 'recommend', reason: 'a' },
        { category: 'fish', level: 'limit', reason: 'b' },
      ],
    });
    expect(r?.categories).toEqual([{ category: 'fish', level: 'recommend', reason: 'a' }]);
  });

  it('料理のない献立の例は捨て、名前がなければ「案n」にする', () => {
    const r = checkAdviceContent({ ...good, menus: [{ label: '', dishes: [] }, { label: ' ', dishes: [' 納豆 ', ''] }] });
    expect(r?.menus).toEqual([{ label: '案1', dishes: ['納豆'] }]);
  });

  it('一言がない、または種類と献立の例の両方がないときはnull', () => {
    expect(checkAdviceContent({ ...good, summary: ' ' })).toBeNull();
    expect(checkAdviceContent({ ...good, categories: [], menus: [] })).toBeNull();
    expect(checkAdviceContent('文章')).toBeNull();
    expect(checkAdviceContent(null)).toBeNull();
  });

  it('ポイントがなくても受け取る', () => {
    const r = checkAdviceContent({ ...good, points: undefined });
    expect(r?.points).toEqual([]);
  });
});

describe('groupByLevel・adviceToText', () => {
  it('おすすめ→食べてOK→控えめにの順に並べる', () => {
    const groups = groupByLevel([...good.categories].reverse() as never);
    expect(groups.map((g) => g.level)).toEqual(['recommend', 'ok', 'limit']);
  });

  it('文章にする', () => {
    const r = checkAdviceContent(good);
    expect(r && adviceToText(r)).toBe(
      'たんぱく質が足りていません\n【おすすめ】魚（たんぱく質を補える）\n【食べてOK】肉（脂質にまだ余裕）\n【控えめに】揚げ物・脂っこいもの\n案1：鮭の塩焼き、ほうれん草のおひたし\n・塩分は控えめに',
    );
  });
});
