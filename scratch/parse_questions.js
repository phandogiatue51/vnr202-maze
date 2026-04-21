const fs = require('fs');

const content = fs.readFileSync('QUESTION.MD', 'utf8');
const questions = [];
const regex = /(\d+)\.\s*([\s\S]+?)\s*A\.\s*(.*?)\s*B\.\s*(.*?)\s*C\.\s*(.*?)\s*D\.\s*(.*?)\s*→\s*Đáp án:\s*([A-D])/g;

let match;
while ((match = regex.exec(content)) !== null) {
    questions.push({
        id: parseInt(match[1]),
        text: match[2].trim().replace(/\r?\n/g, ' '),
        options: [
            match[3].trim(),
            match[4].trim(),
            match[5].trim(),
            match[6].trim()
        ],
        answer: match[7].trim()
    });
}

fs.writeFileSync('src/constants/questions.json', JSON.stringify(questions, null, 2));
console.log(`Parsed ${questions.length} questions.`);
