// ~40 adjectives x ~40 animals = ~1600 nickname combinations
const adjectives = [
  '快乐', '开心', '幸福', '活泼', '可爱',
  '聪明', '勇敢', '善良', '温柔', '热情',
  '幽默', '忠诚', '诚实', '勤奋', '乐观',
  '自信', '独立', '优雅', '大方', '稳重',
  '细心', '耐心', '专心', '用心', '真心',
  '诚心', '热心', '爱心', '信心', '决心',
  '恒心', '虚心', '积极', '开朗', '阳光',
  '浪漫', '洒脱', '豁达', '沉着', '从容',
];

const animals = [
  '海豚', '熊猫', '兔子', '猫咪', '小狗',
  '松鼠', '企鹅', '考拉', '狐狸', '柴犬',
  '金毛', '柯基', '泰迪', '布偶猫', '英短',
  '美短', '暹罗猫', '波斯猫', '缅因猫', '橘猫',
  '蓝猫', '黑猫', '白猫', '花猫', '奶牛猫',
  '三花猫', '狸花猫', '玄猫', '狮子猫', '山东狮子猫',
  '喜马拉雅猫', '伯曼猫', '挪威森林猫', '西伯利亚猫', '土耳其安哥拉猫',
  '土耳其梵猫', '埃及猫', '阿比西尼亚猫', '美国短尾猫', '美国卷耳猫',
];

// Generate a random nickname in format "快乐的海豚"
export function generateNickname(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${adj}的${animal}`;
}
