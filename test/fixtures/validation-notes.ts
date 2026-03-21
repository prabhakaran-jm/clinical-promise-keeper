export type ExpectedPromise = {
  description: string;
  class: "lab" | "appointment" | "imaging_document";
  relativeTerm: string;
};

export type ValidationNote = {
  id: string;
  specialty: string;
  noteDate: string;
  noteText: string;
  expectedPromises: ExpectedPromise[];
};

export const validationNotes: ValidationNote[] = [
  {
    id: "pc-01",
    specialty: "primary-care",
    noteDate: "2026-02-15",
    noteText: `OFFICE VISIT - ANNUAL PHYSICAL

Chief Complaint: Annual wellness exam

Assessment and Plan:
1. Hyperlipidemia - LDL 145, above target
   - Start atorvastatin 20mg daily
   - Recheck lipid panel in 6 weeks
   - Dietary counseling provided
2. Preventive Care
   - Due for colonoscopy (age 50, average risk). Refer to GI for screening colonoscopy.
   - Mammogram ordered, schedule within 3 months
   - Flu vaccine administered today
3. Follow-up in 6 months or sooner if concerns.

Signed: Dr. Amanda Torres, MD`,
    expectedPromises: [
      { description: "Recheck lipid panel", class: "lab", relativeTerm: "in 6 weeks" },
      { description: "Colonoscopy referral", class: "appointment", relativeTerm: "soon" },
      { description: "Schedule mammogram", class: "imaging_document", relativeTerm: "within 3 months" },
      { description: "Follow-up visit", class: "appointment", relativeTerm: "in 6 months" },
    ],
  },
  {
    id: "pc-02",
    specialty: "primary-care",
    noteDate: "2026-01-10",
    noteText: `FOLLOW UP - HYPERTENSION AND DIABETES

HPI: 62yo male returns for BP and diabetes management. Home BP readings averaging 148/92. Reports occasional dizziness.

Assessment and Plan:
1. Hypertension - uncontrolled
   - Increase amlodipine from 5mg to 10mg daily
   - Recheck BMP and potassium in 2 weeks to monitor renal function
   - Home BP log review at next visit
2. Type 2 Diabetes - A1c 7.1%, at goal
   - Continue metformin 1000mg BID
   - Annual diabetic eye exam overdue - refer to ophthalmology
   - Annual foot exam performed today - monofilament intact
3. Return in 8 weeks

Signed: Dr. Robert Kim, MD`,
    expectedPromises: [
      { description: "Recheck BMP and potassium", class: "lab", relativeTerm: "in 2 weeks" },
      { description: "Ophthalmology referral", class: "appointment", relativeTerm: "soon" },
      { description: "Return visit", class: "appointment", relativeTerm: "in 8 weeks" },
    ],
  },
  {
    id: "pc-03",
    specialty: "primary-care",
    noteDate: "2026-03-01",
    noteText: `NEW PATIENT VISIT

HPI: 35yo female establishing care. History of anxiety and GERD. No current medications. Last PCP visit was 3 years ago.

Assessment and Plan:
1. Anxiety - mild, situational
   - Start sertraline 25mg daily, titrate to 50mg after 1 week if tolerated
   - Follow up in 4 weeks to assess medication response
   - Consider therapy referral if no improvement
2. GERD - intermittent symptoms
   - Trial of omeprazole 20mg daily for 8 weeks
   - If no improvement, will order upper endoscopy
3. Preventive Care
   - Pap smear performed today, await results
   - Order baseline CBC, CMP, TSH, lipid panel
   - Tdap booster administered
4. Return in 4 weeks

Signed: Dr. Lisa Nguyen, MD`,
    expectedPromises: [
      { description: "Follow-up for medication response", class: "appointment", relativeTerm: "in 4 weeks" },
      { description: "Baseline lab panel (CBC, CMP, TSH, lipid)", class: "lab", relativeTerm: "soon" },
      { description: "Return visit", class: "appointment", relativeTerm: "in 4 weeks" },
    ],
  },
  {
    id: "pc-04",
    specialty: "primary-care",
    noteDate: "2026-02-28",
    noteText: `FOLLOW UP - COPD

HPI: 71yo male with moderate COPD. Using tiotropium and albuterol PRN. Reports increased dyspnea with exertion over past month. No fever, no change in sputum.

Assessment and Plan:
1. COPD - worsening symptoms
   - Add fluticasone/salmeterol 250/50 BID
   - Order PFTs to reassess lung function - schedule within 2 weeks
   - Check CBC and BMP
   - If PFTs show significant decline, will refer to pulmonology
2. Smoking cessation
   - Patient currently smoking 1/2 ppd, down from 1 ppd
   - Discussed varenicline, patient will consider
3. Immunizations
   - Pneumovax 23 due - administered today
   - Shingrix dose 2 needed - schedule in 2 months
4. Follow up in 6 weeks

Signed: Dr. James Mitchell, DO`,
    expectedPromises: [
      { description: "PFTs to reassess lung function", class: "imaging_document", relativeTerm: "within 2 weeks" },
      { description: "Check CBC and BMP", class: "lab", relativeTerm: "soon" },
      { description: "Shingrix dose 2", class: "appointment", relativeTerm: "in 2 months" },
      { description: "Follow-up visit", class: "appointment", relativeTerm: "in 6 weeks" },
    ],
  },
  {
    id: "pc-05",
    specialty: "primary-care",
    noteDate: "2026-01-20",
    noteText: `WELL CHILD CHECK - 12 MONTH

HPI: 12-month-old male for well child check. Meeting all developmental milestones. Eating table foods well. Sleeping through the night.

Exam: Normal growth parameters. No concerns.

Assessment and Plan:
1. Health Maintenance
   - Vaccines: MMR #1, Varicella #1, Hep A #1 administered today
   - Lead level and CBC ordered
   - Schedule Hep A #2 in 6 months
2. Anticipatory guidance provided: dental visit, transitioning from bottle, safety
3. Next well child check at 15 months

Signed: Dr. Sarah Patterson, MD`,
    expectedPromises: [
      { description: "Lead level and CBC", class: "lab", relativeTerm: "soon" },
      { description: "Hep A dose 2", class: "appointment", relativeTerm: "in 6 months" },
      { description: "Well child check at 15 months", class: "appointment", relativeTerm: "in 3 months" },
    ],
  },
  {
    id: "card-01",
    specialty: "cardiology",
    noteDate: "2026-02-10",
    noteText: `CARDIOLOGY CONSULTATION

Reason for Referral: Newly diagnosed atrial fibrillation

HPI: 68yo female referred by PCP after ECG showed atrial fibrillation during routine visit. Asymptomatic. No chest pain, syncope, or dyspnea.

Assessment and Plan:
1. Atrial fibrillation - new onset, asymptomatic
   - CHA2DS2-VASc score: 3 (age, sex, hypertension)
   - Start apixaban 5mg BID for stroke prevention
   - Order echocardiogram to assess chamber size and function
   - Order TSH to rule out thyroid-related AF
   - Holter monitor for 48 hours to assess rate control
2. Rate control
   - Start metoprolol succinate 25mg daily
   - Target resting HR < 110
3. Follow up in 4 weeks with echo and Holter results
   - Will discuss rhythm vs rate control strategy

Signed: Dr. Michael Chang, MD, FACC`,
    expectedPromises: [
      { description: "Echocardiogram", class: "imaging_document", relativeTerm: "soon" },
      { description: "TSH lab", class: "lab", relativeTerm: "soon" },
      { description: "Holter monitor", class: "imaging_document", relativeTerm: "soon" },
      { description: "Cardiology follow-up", class: "appointment", relativeTerm: "in 4 weeks" },
    ],
  },
  {
    id: "card-02",
    specialty: "cardiology",
    noteDate: "2026-03-05",
    noteText: `POST-MI FOLLOW UP

HPI: 55yo male, 6 weeks post-STEMI with PCI to LAD. Doing well in cardiac rehab. Chest pain free. Tolerating medications.

Labs from last week: LDL 78, A1c 5.9

Assessment and Plan:
1. CAD, s/p PCI
   - Continue DAPT (aspirin + clopidogrel) for minimum 12 months
   - Continue high-intensity statin (rosuvastatin 40mg)
   - LDL at goal, recheck lipid panel in 6 months
2. Cardiac rehab - progressing well, continue
3. Repeat echocardiogram in 3 months to reassess LV function (EF was 45% post-MI)
4. Stress test at 6 months post-event
5. Return to cardiology in 3 months

Signed: Dr. Elena Vasquez, MD, FACC`,
    expectedPromises: [
      { description: "Recheck lipid panel", class: "lab", relativeTerm: "in 6 months" },
      { description: "Repeat echocardiogram", class: "imaging_document", relativeTerm: "in 3 months" },
      { description: "Stress test", class: "imaging_document", relativeTerm: "in 6 months" },
      { description: "Cardiology follow-up", class: "appointment", relativeTerm: "in 3 months" },
    ],
  },
  {
    id: "card-03",
    specialty: "cardiology",
    noteDate: "2026-02-20",
    noteText: `HEART FAILURE MANAGEMENT

HPI: 73yo female with HFrEF (EF 30%), NYHA Class II. Stable symptoms. Weight stable. No edema.

Assessment and Plan:
1. Heart failure - stable Class II
   - Continue sacubitril/valsartan 49/51mg BID
   - Continue carvedilol 12.5mg BID
   - Add spironolactone 25mg daily, check potassium and creatinine in 1 week
   - BNP today for trending
2. ICD evaluation
   - EF remains <=35% on optimal medical therapy for >3 months
   - Refer to electrophysiology for ICD evaluation
3. Diet: Sodium restriction counseling reinforced
4. Follow up in 6 weeks with repeat BNP

Signed: Dr. David Park, MD`,
    expectedPromises: [
      { description: "Check potassium and creatinine", class: "lab", relativeTerm: "in 1 week" },
      { description: "Electrophysiology referral for ICD", class: "appointment", relativeTerm: "soon" },
      { description: "Follow-up with repeat BNP", class: "appointment", relativeTerm: "in 6 weeks" },
    ],
  },
  {
    id: "onc-01",
    specialty: "oncology",
    noteDate: "2026-01-15",
    noteText: `ONCOLOGY FOLLOW UP - BREAST CANCER SURVEILLANCE

HPI: 52yo female, 2 years post-treatment for Stage II ER+ breast cancer (lumpectomy, chemo, radiation). On tamoxifen. No concerning symptoms. No palpable masses.

Assessment and Plan:
1. Breast cancer surveillance
   - Continue tamoxifen for total of 5 years
   - Annual mammogram due - order bilateral diagnostic mammogram
   - CA 27-29 and CBC for trending
2. Survivorship care
   - DEXA scan needed given tamoxifen use and age - schedule within 3 months
   - Continue vitamin D 2000 IU daily
   - Annual gynecologic exam due - coordinate with OB/GYN
3. Mental health
   - Screening positive for mild anxiety related to cancer recurrence fear
   - Refer to oncology social worker / support group
4. Return in 6 months

Signed: Dr. Rachel Green, MD`,
    expectedPromises: [
      { description: "Bilateral diagnostic mammogram", class: "imaging_document", relativeTerm: "soon" },
      { description: "CA 27-29 and CBC labs", class: "lab", relativeTerm: "soon" },
      { description: "DEXA scan", class: "imaging_document", relativeTerm: "within 3 months" },
      { description: "GYN annual exam coordination", class: "appointment", relativeTerm: "soon" },
      { description: "Oncology social worker referral", class: "appointment", relativeTerm: "soon" },
      { description: "Oncology follow-up", class: "appointment", relativeTerm: "in 6 months" },
    ],
  },
  {
    id: "onc-02",
    specialty: "oncology",
    noteDate: "2026-03-10",
    noteText: `LUNG CANCER SCREENING FOLLOW UP

HPI: 65yo male with 30 pack-year smoking history (quit 5 years ago). LDCT screening showed 8mm ground glass nodule in RUL, stable compared to 6 months prior.

Assessment and Plan:
1. Pulmonary nodule - stable 8mm GGN
   - Per Fleischner criteria, recommend repeat LDCT in 6 months
   - If growth, will refer to thoracic surgery for biopsy consideration
2. Smoking cessation - maintained, congratulated patient
3. Lung cancer screening to continue annually per USPSTF guidelines
4. PFTs if considering biopsy in future
5. Return after next LDCT scan

Signed: Dr. William Chen, MD`,
    expectedPromises: [
      { description: "Repeat LDCT scan", class: "imaging_document", relativeTerm: "in 6 months" },
      { description: "Follow-up after LDCT", class: "appointment", relativeTerm: "in 6 months" },
    ],
  },
  {
    id: "endo-01",
    specialty: "endocrinology",
    noteDate: "2026-02-05",
    noteText: `ENDOCRINOLOGY - THYROID NODULE FOLLOW UP

HPI: 45yo female with 1.5cm thyroid nodule found incidentally on neck CT. FNA performed today showing Bethesda III (atypia of undetermined significance).

Assessment and Plan:
1. Thyroid nodule - Bethesda III
   - Recommend molecular testing (Afirma/ThyroSeq) on the FNA specimen
   - If molecular test suspicious, will schedule thyroid lobectomy
   - If benign molecular test, repeat ultrasound in 12 months
2. Thyroid function
   - TSH and free T4 today - results pending
   - If abnormal, will adjust management
3. Follow up in 2 weeks to discuss molecular testing results

Signed: Dr. Priya Sharma, MD`,
    expectedPromises: [
      { description: "Molecular testing on FNA specimen", class: "lab", relativeTerm: "soon" },
      { description: "Follow-up for molecular results", class: "appointment", relativeTerm: "in 2 weeks" },
    ],
  },
  {
    id: "endo-02",
    specialty: "endocrinology",
    noteDate: "2026-01-25",
    noteText: `DIABETES MANAGEMENT - INSULIN INITIATION

HPI: 58yo female with T2DM, A1c 9.8% despite max oral agents. Starting basal insulin today.

Assessment and Plan:
1. T2DM - uncontrolled
   - Start insulin glargine 10 units at bedtime
   - Continue metformin 1000mg BID
   - Discontinue glipizide (hypoglycemia risk with insulin)
   - Patient education on insulin administration, hypoglycemia management
   - Recheck A1c in 3 months
   - Fasting glucose log - review in 2 weeks for dose titration
2. Diabetic complications screening
   - Urine microalbumin ordered
   - Refer to ophthalmology for dilated eye exam (overdue)
   - Foot exam today - intact sensation
3. Follow up in 2 weeks for insulin dose adjustment

Signed: Dr. Carlos Mendez, MD`,
    expectedPromises: [
      { description: "Recheck A1c", class: "lab", relativeTerm: "in 3 months" },
      { description: "Fasting glucose log review", class: "appointment", relativeTerm: "in 2 weeks" },
      { description: "Urine microalbumin", class: "lab", relativeTerm: "soon" },
      { description: "Ophthalmology referral", class: "appointment", relativeTerm: "soon" },
      { description: "Follow-up for insulin adjustment", class: "appointment", relativeTerm: "in 2 weeks" },
    ],
  },
  {
    id: "surg-01",
    specialty: "surgery",
    noteDate: "2026-03-01",
    noteText: `POST-OP DAY 14 - LAPAROSCOPIC CHOLECYSTECTOMY

HPI: 42yo female, 2 weeks post lap chole for symptomatic cholelithiasis. Incisions healing well. Tolerating regular diet. Mild residual discomfort at umbilical port site.

Assessment and Plan:
1. Post-operative
   - Incisions clean, dry, intact. Steri-strips falling off naturally.
   - Resume full activity as tolerated
   - If persistent pain beyond 4 weeks, obtain abdominal ultrasound to rule out retained stone or fluid collection
2. Pathology
   - Final path pending on gallbladder specimen, will call with results
3. Follow up in 4 weeks for final post-op check
   - If doing well, will discharge from surgical care

Signed: Dr. Karen Wu, MD, FACS`,
    expectedPromises: [
      { description: "Call with pathology results", class: "lab", relativeTerm: "soon" },
      { description: "Post-op follow-up", class: "appointment", relativeTerm: "in 4 weeks" },
    ],
  },
  {
    id: "surg-02",
    specialty: "surgery",
    noteDate: "2026-02-14",
    noteText: `ORTHOPEDIC FOLLOW UP - ACL RECONSTRUCTION

HPI: 28yo male, 6 weeks post ACL reconstruction (left knee, hamstring autograft). Attending physical therapy 3x/week. Good ROM progress.

Exam: ROM 5-120 degrees. Mild effusion. Stable Lachman. Quad activation improving.

Assessment and Plan:
1. ACL reconstruction - progressing well
   - Continue PT 3x/week through 12 weeks post-op
   - Progress to closed chain exercises
   - Fitted for functional brace today
2. Imaging
   - MRI at 6 months post-op to assess graft incorporation
3. Milestones
   - Light jogging at 4 months if quad strength >70% contralateral
   - Return to sport assessment at 9 months
4. Follow up in 6 weeks
5. Obtain PT progress notes from SportsMed Physical Therapy

Signed: Dr. Thomas Anderson, MD`,
    expectedPromises: [
      { description: "MRI to assess graft", class: "imaging_document", relativeTerm: "in 6 months" },
      { description: "Orthopedic follow-up", class: "appointment", relativeTerm: "in 6 weeks" },
      { description: "Obtain PT progress notes", class: "imaging_document", relativeTerm: "soon" },
    ],
  },
  {
    id: "psych-01",
    specialty: "psychiatry",
    noteDate: "2026-02-25",
    noteText: `PSYCHIATRY - MEDICATION MANAGEMENT

HPI: 34yo female with MDD and GAD. On sertraline 150mg. Reports improved mood but persistent insomnia and daytime fatigue. PHQ-9: 8 (mild). GAD-7: 12 (moderate).

Assessment and Plan:
1. MDD - partial response to sertraline
   - Increase sertraline to 200mg daily
   - Add trazodone 50mg at bedtime for insomnia
   - Recheck PHQ-9 and GAD-7 at next visit
2. Labs
   - Check TSH, CBC, vitamin D (fatigue workup)
3. Therapy
   - Continue CBT with current therapist
   - Request progress notes from therapist
4. Safety: No SI/HI. Safety plan reviewed.
5. Follow up in 4 weeks

Signed: Dr. Jennifer Liu, MD`,
    expectedPromises: [
      { description: "Lab workup (TSH, CBC, vitamin D)", class: "lab", relativeTerm: "soon" },
      { description: "Request therapist progress notes", class: "imaging_document", relativeTerm: "soon" },
      { description: "Follow-up visit", class: "appointment", relativeTerm: "in 4 weeks" },
    ],
  },
  {
    id: "psych-02",
    specialty: "psychiatry",
    noteDate: "2026-03-15",
    noteText: `ADHD EVALUATION FOLLOW UP

HPI: 19yo male college student evaluated 2 weeks ago for attention difficulties. Completed Vanderbilt assessment forms (self and collateral from parents). Testing suggests ADHD - Combined type.

Assessment and Plan:
1. ADHD - Combined type, newly diagnosed
   - Start methylphenidate ER 18mg daily
   - Review academic accommodations process with patient
   - Provide documentation for disability services
2. Baseline monitoring
   - Check baseline weight, height, BP, HR today
   - Recheck vitals and weight in 1 month
   - ECG not routinely needed but ordered given family history of early cardiac death
3. Follow up in 4 weeks to assess medication response
   - Bring updated grades/academic performance for review
4. Consider neuropsychological testing if response inadequate

Signed: Dr. Mark Thompson, MD`,
    expectedPromises: [
      { description: "Recheck vitals and weight", class: "lab", relativeTerm: "in 1 month" },
      { description: "ECG", class: "imaging_document", relativeTerm: "soon" },
      { description: "Follow-up for medication response", class: "appointment", relativeTerm: "in 4 weeks" },
    ],
  },
  {
    id: "edge-01",
    specialty: "primary-care",
    noteDate: "2026-03-10",
    noteText: `ACUTE VISIT - URI

HPI: 30yo male with 3 days of nasal congestion, sore throat, mild cough. No fever. No dyspnea.

Exam: Mild pharyngeal erythema. Lungs clear. No lymphadenopathy.

Assessment and Plan:
1. Acute URI - viral, self-limited
   - Supportive care: rest, fluids, OTC decongestants
   - Honey for cough
   - No antibiotics indicated
   - Return if worsening or not improved in 7-10 days

Signed: Dr. Amy Wright, MD`,
    expectedPromises: [],
  },
  {
    id: "edge-02",
    specialty: "primary-care",
    noteDate: "2026-02-01",
    noteText: `CHRONIC PAIN MANAGEMENT

HPI: 55yo female with chronic low back pain, on stable opioid regimen. Here for monthly check. Pain 4/10, functional. UDS last month compliant.

Assessment and Plan:
1. Chronic pain - stable
   - Continue oxycodone 10mg TID
   - Continue gabapentin 300mg TID
   - Monthly UDS: collect today
   - PDMP reviewed - consistent with prescribed medications
   - Continue current PT regimen
2. Pain agreement reviewed and signed
3. 30-day prescription provided, no early refills
4. Return in 1 month for next assessment

Signed: Dr. Steven Davis, MD`,
    expectedPromises: [
      { description: "Return visit for pain assessment", class: "appointment", relativeTerm: "in 1 month" },
    ],
  },
  {
    id: "edge-03",
    specialty: "emergency-medicine",
    noteDate: "2026-03-18",
    noteText: `ED DISCHARGE SUMMARY

HPI: 45yo male presented with acute chest pain, troponin negative x2, ECG normal sinus rhythm, no acute ST changes.

Disposition: Discharge home

Discharge Instructions:
1. Follow up with PCP within 3 days
2. Follow up with cardiology within 1 week for stress test
3. If chest pain recurs, worsens, or associated with shortness of breath, return to ED immediately
4. Continue aspirin 81mg daily
5. Obtain outpatient lipid panel and glucose

Signed: Dr. Jason Miller, MD`,
    expectedPromises: [
      { description: "PCP follow-up", class: "appointment", relativeTerm: "within 3 days" },
      { description: "Cardiology follow-up for stress test", class: "appointment", relativeTerm: "within 1 week" },
      { description: "Outpatient lipid panel and glucose", class: "lab", relativeTerm: "soon" },
    ],
  },
  {
    id: "edge-04",
    specialty: "primary-care",
    noteDate: "2026-01-05",
    noteText: `TELEMEDICINE VISIT - MEDICATION REFILL

HPI: 40yo female requesting refill of lisinopril and metformin. Reports feeling well. No new symptoms. Last in-office visit 4 months ago.

Assessment and Plan:
1. Hypertension - stable per patient report
   - Refill lisinopril 20mg #90
   - Need in-office BP check - schedule within 2 weeks
2. T2DM - stable per patient report
   - Refill metformin 500mg BID #180
   - A1c overdue (last was 8 months ago) - order A1c lab
3. Overdue for in-person comprehensive visit
   - Schedule office visit within 1 month for full assessment
   - At that visit: complete metabolic panel, lipids, urinalysis

Signed: Dr. Maria Santos, MD`,
    expectedPromises: [
      { description: "In-office BP check", class: "appointment", relativeTerm: "within 2 weeks" },
      { description: "A1c lab", class: "lab", relativeTerm: "soon" },
      { description: "Comprehensive office visit", class: "appointment", relativeTerm: "within 1 month" },
    ],
  },
  {
    id: "edge-05",
    specialty: "nephrology",
    noteDate: "2026-02-12",
    noteText: `NEPHROLOGY FOLLOW UP - CKD STAGE 3A

HPI: 67yo male with CKD stage 3a and hypertension. No edema, no uremic symptoms. Home BP averaging 132/78. Denies NSAID use. Appetite and energy are stable.

Assessment and Plan:
1. CKD stage 3a - stable renal function
   - Avoid nephrotoxic agents and maintain hydration
   - Repeat BMP, urine albumin/creatinine ratio, and phosphorus in 8 weeks
   - Renal ultrasound if creatinine worsens or if persistent hematuria recurs
2. Hypertension
   - Continue losartan 50mg daily
   - Goal BP <130/80 discussed
3. CKD-MBD screening
   - Check PTH and vitamin D at next lab draw
4. Return to nephrology in 3 months

Signed: Dr. Nora Patel, MD`,
    expectedPromises: [
      { description: "Repeat BMP, urine ACR, phosphorus", class: "lab", relativeTerm: "in 8 weeks" },
      { description: "Check PTH and vitamin D", class: "lab", relativeTerm: "soon" },
      { description: "Nephrology follow-up", class: "appointment", relativeTerm: "in 3 months" },
    ],
  },
];
