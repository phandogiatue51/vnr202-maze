const fs = require('fs');
const path = require('path');

const sourcePath = path.resolve(__dirname, '..', 'QUESTION.MD');
const targetPath = path.resolve(__dirname, '..', 'src', 'constants', 'questions.json');
const content = fs.readFileSync(sourcePath, 'utf8').replace(/^\uFEFF/, '');

const lines = content.split(/\r?\n/);
const questions = [];

for (let i = 0; i < lines.length; i += 1) {
  const header = lines[i].trim();
  const match = header.match(/^(\d+)\.\s+(.+)$/);
  if (!match) continue;

  const options = [];
  const optionMap = {};
  let answer = '';

  for (let j = i + 1; j < lines.length; j += 1) {
    const line = lines[j].trim();
    const optionMatch = line.match(/^([A-D])\.\s+(.+)$/);
    if (optionMatch) {
      optionMap[optionMatch[1]] = optionMatch[2].trim();
      continue;
    }

    const answerMatch = line.match(/^→\s*Đáp án:\s*([A-D])$/i);
    if (answerMatch) {
      answer = answerMatch[1].toUpperCase();
      i = j;
      break;
    }
  }

  ['A', 'B', 'C', 'D'].forEach((key) => {
    if (optionMap[key]) {
      options.push(optionMap[key]);
    }
  });

  if (options.length === 4 && answer) {
    questions.push({
      id: Number(match[1]),
      text: match[2].trim(),
      options: options.map((option) => option.trim()),
      answer
    });
  }
}

fs.writeFileSync(targetPath, `${JSON.stringify(questions, null, 2)}\n`, 'utf8');
console.log(`Parsed ${questions.length} questions.`);
