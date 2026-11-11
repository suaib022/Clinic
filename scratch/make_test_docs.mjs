// Generates synthetic test documents (fake patient data) for scratch/test_extraction.mts.
// Run: node scratch/make_test_docs.mjs
import { writeFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';

function render(file, lines) {
    const canvas = createCanvas(1240, 60 + lines.length * 44);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111';
    lines.forEach((l, i) => {
        ctx.font = l.startsWith('#') ? 'bold 30px sans-serif' : '26px sans-serif';
        ctx.fillText(l.replace(/^#/, ''), 50, 60 + i * 44);
    });
    writeFileSync(file, canvas.toBuffer('image/png'));
    console.log('wrote', file);
}

render('scratch/test-prescription.png', [
    '#City General Hospital - Medicine OPD',
    'Name: Test Patient Rahim    Age: 45Y    Sex: M    Mobile: 01712345678',
    'Patient ID: PT0000001    Date: 05/11/2026',
    '',
    '#C/C: Fever for 3 days, burning epigastric pain, headache',
    'O/E: BP 130/85 mmHg, Pulse 92/min, Temp 101 F, Wt 72 kg',
    'Dx: Acute febrile illness; Acid peptic disease',
    'Allergy: Penicillin',
    '',
    '#Rx',
    '1. Tab. Napa 500 mg ......... 1+1+1 (after meal) ...... 5 days',
    '2. Cap. Seclo 20 mg ......... 1+0+1 (before meal) ..... 14 days',
    '3. Tab. Fexo 120 mg ......... 0+0+1 .................... 7 days',
    '4. Syp. Antacid Plus ........ 2 tsp 3 times daily ...... 7 days',
    '',
    'Inv: CBC, CRP, Dengue NS1',
    'Advice: Plenty of water, avoid oily food, rest',
    'Follow up after 7 days with reports',
]);

render('scratch/test-lab-report.png', [
    '#Popular Diagnostic Centre - Haematology & Biochemistry',
    'Patient: Test Patient Karim   Age: 52Y   Contact: 01898765432   Sample Date: 02/11/2026',
    '',
    '#Test                  Result      Unit       Reference Range',
    'Hemoglobin              10.2       g/dL       13.0 - 17.0',
    'WBC Count               11,800     /cumm      4,000 - 11,000',
    'Platelet Count          250,000    /cumm      150,000 - 450,000',
    'ESR                     38         mm/1st hr  0 - 15',
    'Fasting Blood Sugar     7.9        mmol/L     3.9 - 6.1',
    'HbA1c                   7.4        %          4.0 - 5.6',
    'Serum Creatinine        1.0        mg/dL      0.7 - 1.3',
    'Urine Sugar             Nil',
    '',
    'Comment: Findings suggest anemia and poorly controlled diabetes.',
]);
