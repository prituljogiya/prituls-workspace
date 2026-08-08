import express from 'express';
import { body, validationResult } from 'express-validator';
import PDFDocument from 'pdfkit';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = express.Router();

const CONTRACT_MANAGERS = ['SUPER_ADMIN', 'WORKSPACE_OWNER', 'PROJECT_MANAGER'] as const;

router.use(authenticate);
router.use(authorize(...CONTRACT_MANAGERS));

async function nextContractNumber() {
  const year = new Date().getFullYear();
  const prefix = `FC-${year}-`;
  const existing = await prisma.freelancerContract.findMany({
    where: { contractNumber: { startsWith: prefix } },
    select: { contractNumber: true },
  });
  let max = 0;
  for (const row of existing) {
    const n = parseInt(row.contractNumber.slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function contractPayload(body: any, partial = false) {
  const data: any = {};
  const fields = [
    'title',
    'status',
    'companyName',
    'companyEmail',
    'companyPhone',
    'companyAddress',
    'companySignatoryName',
    'companySignatoryTitle',
    'freelancerName',
    'freelancerEmail',
    'freelancerPhone',
    'freelancerAddress',
    'freelancerTaxId',
    'freelancerBankDetails',
    'freelancerUserId',
    'projectId',
    'scopeOfWork',
    'deliverables',
    'techStack',
    'paymentType',
    'currency',
    'paymentTerms',
    'paymentSchedule',
    'intellectualProperty',
    'confidentiality',
    'terminationTerms',
    'workingHours',
    'locationOrRemote',
    'additionalTerms',
    'notes',
  ] as const;

  for (const key of fields) {
    if (body[key] !== undefined) {
      data[key] = body[key] === '' ? null : body[key];
    } else if (!partial && ['title', 'freelancerName', 'freelancerEmail'].includes(key)) {
      // required handled by validators
    }
  }

  if (body.rateOrAmount !== undefined) {
    data.rateOrAmount =
      body.rateOrAmount === '' || body.rateOrAmount === null
        ? null
        : parseFloat(body.rateOrAmount);
  }
  if (body.noticePeriodDays !== undefined) {
    data.noticePeriodDays =
      body.noticePeriodDays === '' || body.noticePeriodDays === null
        ? null
        : parseInt(body.noticePeriodDays, 10);
  }

  for (const key of ['startDate', 'endDate', 'signedAt', 'companySignedAt', 'freelancerSignedAt'] as const) {
    if (body[key] !== undefined) data[key] = parseDate(body[key]);
  }

  if (body.companySigned !== undefined) data.companySigned = Boolean(body.companySigned);
  if (body.freelancerSigned !== undefined) data.freelancerSigned = Boolean(body.freelancerSigned);

  // Empty string relations → null
  if (data.freelancerUserId === '') data.freelancerUserId = null;
  if (data.projectId === '') data.projectId = null;

  return data;
}

const include = {
  creator: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  freelancerUser: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  project: {
    select: { id: true, name: true, workspace: { select: { id: true, name: true } } },
  },
};

// List
router.get('/', async (req: AuthRequest, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const q = req.query.q ? String(req.query.q).trim() : '';
    const contracts = await prisma.freelancerContract.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { freelancerName: { contains: q, mode: 'insensitive' } },
                { freelancerEmail: { contains: q, mode: 'insensitive' } },
                { contractNumber: { contains: q, mode: 'insensitive' } },
                { companyName: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include,
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ contracts });
  } catch (error) {
    console.error('List contracts error:', error);
    res.status(500).json({ error: 'Failed to list contracts' });
  }
});

// Get one
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const contract = await prisma.freelancerContract.findUnique({
      where: { id: req.params.id },
      include,
    });
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    res.json({ contract });
  } catch (error) {
    console.error('Get contract error:', error);
    res.status(500).json({ error: 'Failed to get contract' });
  }
});

// Create
router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('freelancerName').trim().notEmpty().withMessage('Freelancer name is required'),
    body('freelancerEmail').isEmail().withMessage('Valid freelancer email is required'),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const data = contractPayload(req.body);
      const contractNumber = await nextContractNumber();

      const contract = await prisma.freelancerContract.create({
        data: {
          ...data,
          contractNumber,
          createdById: req.userId!,
          currency: data.currency || 'INR',
          paymentType: data.paymentType || 'MONTHLY',
          status: data.status || 'DRAFT',
        },
        include,
      });

      res.status(201).json({ contract });
    } catch (error) {
      console.error('Create contract error:', error);
      res.status(500).json({ error: 'Failed to create contract' });
    }
  }
);

// Update
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.freelancerContract.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) return res.status(404).json({ error: 'Contract not found' });

    const data = contractPayload(req.body, true);
    if (data.freelancerEmail) {
      // light validate
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.freelancerEmail)) {
        return res.status(400).json({ error: 'Invalid freelancer email' });
      }
    }

    const contract = await prisma.freelancerContract.update({
      where: { id: existing.id },
      data,
      include,
    });
    res.json({ contract });
  } catch (error) {
    console.error('Update contract error:', error);
    res.status(500).json({ error: 'Failed to update contract' });
  }
});

// Download PDF — professional IT company freelancer / contractor agreement
router.get('/:id/pdf', async (req: AuthRequest, res) => {
  try {
    const contract = await prisma.freelancerContract.findUnique({
      where: { id: req.params.id },
      include,
    });
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const COMPANY = (contract.companyName || "Pritul's workspace").trim();
    const FREELANCER = (contract.freelancerName || 'Freelancer').trim();
    const INK = '#0f172a';
    const MUTED = '#475569';
    const LINE = '#cbd5e1';
    const ACCENT = '#0f172a';

    // Helvetica / WinAnsi cannot encode smart quotes / em dashes — sanitize all drawn text
    const pdfSafe = (input: unknown) =>
      String(input ?? '')
        .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
        .replace(/[\u201C\u201D\u201E]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/\u00A0/g, ' ')
        .replace(/\u2022/g, '-')
        .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');

    const fmtDate = (d?: Date | null) =>
      d
        ? new Date(d).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })
        : '________________';

    const money =
      contract.rateOrAmount != null
        ? `${contract.currency} ${Number(contract.rateOrAmount).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        : 'as mutually agreed in writing';

    const paymentTypeLabel: Record<string, string> = {
      HOURLY: 'hourly rate',
      MONTHLY: 'monthly retainer',
      FIXED: 'fixed project fee',
      MILESTONE: 'milestone-based fee',
    };

    const noticeDays =
      contract.noticePeriodDays != null && contract.noticePeriodDays > 0
        ? contract.noticePeriodDays
        : 15;

    const orDefault = (value: string | null | undefined, fallback: string) => {
      const t = value?.trim();
      return t || fallback;
    };

    const scopeText = orDefault(
      contract.scopeOfWork,
      `The Freelancer shall provide professional information technology services to ${COMPANY}, including software development, engineering, design, consulting, testing, documentation, and related deliverables as instructed by ${COMPANY} from time to time.`
    );
    const deliverablesText = orDefault(
      contract.deliverables,
      'All source code, configurations, designs, documentation, reports, and other work product created under this Agreement, delivered in a usable form acceptable to the Company, within the agreed timelines.'
    );
    const techText = orDefault(
      contract.techStack,
      'Technologies, frameworks, tools, and platforms as specified by the Company for each assignment.'
    );
    const hoursText = orDefault(
      contract.workingHours,
      'As mutually agreed; Freelancer shall remain reasonably available during the Company’s business hours for meetings, reviews, and urgent support.'
    );
    const locationText = orDefault(
      contract.locationOrRemote,
      'Remote / work-from-home, unless the Company requires on-site attendance with reasonable notice.'
    );
    const paymentTermsText = orDefault(
      contract.paymentTerms,
      'Invoices shall be submitted as per the payment schedule. Payment shall be made within fifteen (15) days of a valid invoice, subject to acceptance of deliverables.'
    );
    const paymentScheduleText = orDefault(
      contract.paymentSchedule,
      `Fees are payable on a ${paymentTypeLabel[contract.paymentType] || 'agreed'} basis.`
    );
    const ipText = orDefault(
      contract.intellectualProperty,
      `All work product, inventions, source code, documentation, designs, and materials created by the Freelancer in the course of performing services under this Agreement (“Work Product”) shall be the sole and exclusive property of ${COMPANY}. The Freelancer hereby irrevocably assigns to ${COMPANY} all worldwide right, title, and interest in and to the Work Product, including all intellectual property rights therein. The Freelancer waives any moral rights to the maximum extent permitted by law.`
    );
    const confText = orDefault(
      contract.confidentiality,
      `The Freelancer shall hold in strict confidence all Confidential Information of ${COMPANY} (including source code, credentials, client data, business plans, pricing, and trade secrets), and shall not disclose or use such information except as required to perform services under this Agreement. This obligation survives termination of this Agreement for a period of three (3) years, or indefinitely for trade secrets.`
    );
    const termText = orDefault(
      contract.terminationTerms,
      `Either Party may terminate this Agreement by giving ${noticeDays} days’ prior written notice. ${COMPANY} may terminate immediately for material breach, misconduct, confidentiality breach, IP infringement, or failure to deliver. Upon termination, the Freelancer shall deliver all Work Product and return Company property, and shall be paid only for accepted services performed up to the effective termination date.`
    );
    const additionalText = contract.additionalTerms?.trim() || '';

    const doc = new PDFDocument({
      margin: 54,
      size: 'A4',
      info: {
        Title: `Independent Contractor Agreement — ${contract.contractNumber}`,
        Author: COMPANY,
        Subject: 'IT Freelancer / Independent Contractor Services Agreement',
      },
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=IT-Contract-${contract.contractNumber}.pdf`
    );
    doc.pipe(res);

    const pageW = doc.page.width;
    const left = 54;
    const contentW = pageW - 108;
    let y = 54;
    let clauseNo = 0;

    const ensureSpace = (need: number) => {
      if (y + need > doc.page.height - 64) {
        doc.addPage();
        y = 54;
        drawFooter();
      }
    };

    const drawFooter = () => {
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(MUTED)
        .text(
          pdfSafe(
            `${COMPANY} | Confidential | Contract ${contract.contractNumber} | ${contract.title}`
          ),
          left,
          doc.page.height - 36,
          { width: contentW, align: 'center', lineBreak: false }
        );
    };

    const hr = () => {
      ensureSpace(14);
      doc
        .moveTo(left, y)
        .lineTo(left + contentW, y)
        .strokeColor(LINE)
        .lineWidth(0.8)
        .stroke();
      y += 12;
    };

    const para = (text: string, opts?: { bold?: boolean; size?: number; color?: string; indent?: number }) => {
      const safe = pdfSafe(text);
      const size = opts?.size ?? 9.5;
      const indent = opts?.indent ?? 0;
      doc.font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(opts?.color || INK);
      const h = doc.heightOfString(safe, { width: contentW - indent, align: 'justify' });
      ensureSpace(h + 8);
      doc.text(safe, left + indent, y, { width: contentW - indent, align: 'justify' });
      y += h + 8;
    };

    const clause = (title: string, body: string | string[]) => {
      clauseNo += 1;
      ensureSpace(40);
      para(`${clauseNo}. ${pdfSafe(title)}`, { bold: true, size: 10.5 });
      const parts = Array.isArray(body) ? body : [body];
      parts.forEach((p, idx) => {
        if (parts.length > 1) {
          para(`${clauseNo}.${idx + 1}  ${pdfSafe(p)}`, { size: 9.5, indent: 8 });
        } else {
          para(pdfSafe(p), { size: 9.5, indent: 8 });
        }
      });
      y += 2;
    };

    // —— Cover / header ——
    doc.rect(0, 0, pageW, 6).fill(ACCENT);
    y = 36;
    para(COMPANY.toUpperCase(), { bold: true, size: 11, color: MUTED });
    y += 4;
    para('INDEPENDENT CONTRACTOR / FREELANCER SERVICES AGREEMENT', {
      bold: true,
      size: 14,
    });
    para('(Information Technology & Software Development Services)', {
      bold: true,
      size: 9,
      color: MUTED,
    });
    hr();

    para(
      `This Independent Contractor Services Agreement (“Agreement”) is entered into as of ${fmtDate(
        contract.signedAt || contract.startDate || new Date()
      )} (“Effective Date”).`,
      { size: 9.5 }
    );

    // Meta box
    ensureSpace(70);
    const metaTop = y;
    doc.rect(left, metaTop, contentW, 58).strokeColor(LINE).lineWidth(0.8).stroke();
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
    doc.text(`Contract No.: ${contract.contractNumber}`, left + 10, metaTop + 10);
    doc.text(`Status: ${contract.status}`, left + 260, metaTop + 10);
    doc.text(`Engagement: ${contract.title}`, left + 10, metaTop + 26, { width: contentW - 20 });
    doc.text(`Term: ${fmtDate(contract.startDate)}  to  ${fmtDate(contract.endDate)}`, left + 10, metaTop + 42);
    y = metaTop + 70;

    clause('PARTIES', [
      `Company / Client: ${COMPANY}${contract.companyAddress ? `, having its address at ${contract.companyAddress}` : ''}${
        contract.companyEmail ? ` (Email: ${contract.companyEmail})` : ''
      }${contract.companyPhone ? ` (Phone: ${contract.companyPhone})` : ''} (hereinafter “Company”).`,
      `Freelancer / Independent Contractor: ${FREELANCER}${
        contract.freelancerAddress ? `, residing at ${contract.freelancerAddress}` : ''
      } (Email: ${contract.freelancerEmail}${
        contract.freelancerPhone ? `; Phone: ${contract.freelancerPhone}` : ''
      }${contract.freelancerTaxId ? `; Tax ID / PAN: ${contract.freelancerTaxId}` : ''}) (hereinafter “Freelancer”).`,
      `Company and Freelancer are collectively referred to as the “Parties” and individually as a “Party”.`,
    ]);

    if (contract.project) {
      clause(
        'LINKED PROJECT',
        `This engagement is associated with project “${contract.project.name}”${
          contract.project.workspace?.name ? ` under workspace “${contract.project.workspace.name}”` : ''
        }. Project association does not limit the Freelancer’s obligations under this Agreement.`
      );
    }

    clause('RECITALS', [
      `The Company is engaged in information technology, software product development, consulting, and related digital services.`,
      `The Freelancer represents that they possess the skills, qualifications, and capacity to provide professional IT services as an independent contractor.`,
      `The Parties desire to set forth the terms and conditions governing the Freelancer’s engagement. NOW, THEREFORE, in consideration of the mutual covenants herein, the Parties agree as follows:`,
    ]);

    clause('ENGAGEMENT AND APPOINTMENT', [
      `The Company hereby engages the Freelancer as an independent contractor to perform the IT services described in this Agreement, and the Freelancer accepts such engagement.`,
      `Nothing in this Agreement shall be construed as creating a relationship of employer-employee, partnership, joint venture, or agency. The Freelancer shall not represent themselves as an employee of the Company.`,
      `The Freelancer shall not be entitled to employee benefits including provident fund, gratuity, bonus, paid leave, medical insurance, or similar statutory employment benefits, unless expressly agreed in writing.`,
    ]);

    clause('SCOPE OF WORK', [
      scopeText,
      `Deliverables: ${deliverablesText}`,
      `Technology / Stack: ${techText}`,
      `The Freelancer shall perform services professionally, diligently, and in accordance with industry standards and any coding, security, or documentation guidelines provided by the Company.`,
      `The Freelancer shall not subcontract or assign work to third parties without prior written approval of the Company.`,
    ]);

    clause('TERM AND DURATION', [
      `This Agreement shall commence on ${fmtDate(contract.startDate)} and continue until ${fmtDate(
        contract.endDate
      )}, unless earlier terminated in accordance with this Agreement.`,
      `If no end date is specified, the Agreement continues on a month-to-month basis until terminated by either Party.`,
      `Completion of a particular milestone or deliverable does not automatically terminate this Agreement unless the Parties agree in writing.`,
    ]);

    clause('WORKING HOURS, AVAILABILITY AND LOCATION', [
      `Working hours / availability: ${hoursText}`,
      `Place of work: ${locationText}`,
      `The Freelancer shall attend sprint planning, stand-ups, demos, and review meetings as reasonably requested by the Company.`,
      `Time reported (where applicable) shall be accurate. Misrepresentation of hours or progress constitutes material breach.`,
    ]);

    clause('FEES AND PAYMENT', [
      `Compensation type: ${paymentTypeLabel[contract.paymentType] || contract.paymentType}. Rate / Amount: ${money}.`,
      `Payment schedule: ${paymentScheduleText}`,
      `Payment terms: ${paymentTermsText}`,
      contract.freelancerBankDetails
        ? `Payments shall be remitted to the Freelancer’s nominated account: ${contract.freelancerBankDetails}.`
        : 'Payments shall be remitted to the Freelancer’s nominated bank account as intimated in writing.',
      `The Company may withhold payment for deliverables that are incomplete, defective, or rejected until remedied to the Company’s reasonable satisfaction.`,
      `Unless otherwise stated, fees are exclusive of applicable taxes. GST / tax invoices shall be raised where legally required.`,
    ]);

    clause('TAXES AND COMPLIANCE', [
      `The Freelancer is solely responsible for all income tax, professional tax, GST registration (if applicable), and other statutory compliances arising from fees paid under this Agreement.`,
      `The Company may deduct tax at source (TDS) or equivalent withholding as required by applicable law and furnish appropriate certificates.`,
      `The Freelancer shall provide PAN / Tax ID and other KYC documents reasonably requested by the Company.`,
    ]);

    clause('INDEPENDENT CONTRACTOR STATUS', [
      `The Freelancer retains sole control over the manner and means of performing the services, subject to delivery dates, quality standards, and security requirements set by the Company.`,
      `The Freelancer may provide similar services to other clients, provided such work does not conflict with confidentiality, IP, non-solicitation, or exclusivity obligations under this Agreement.`,
      `The Freelancer shall supply their own equipment unless the Company provides tools, licenses, or access credentials for project use.`,
    ]);

    clause('INTELLECTUAL PROPERTY', [ipText, `The Freelancer retains no license to reuse Company Work Product for other clients or personal portfolios without prior written consent of the Company, except for generic, non-confidential skills and know-how.`]);

    clause('CONFIDENTIALITY AND NON-DISCLOSURE', [
      confText,
      `Upon request or upon termination, the Freelancer shall return or securely destroy all Confidential Information and certify destruction in writing if asked.`,
      `Credentials, VPN access, repositories, cloud consoles, and client systems shall be used solely for authorized work and must not be shared.`,
    ]);

    clause('DATA PROTECTION AND INFORMATION SECURITY', [
      `The Freelancer shall comply with the Company’s information security policies and applicable data protection laws when handling personal data or customer data.`,
      `The Freelancer shall not copy production data to personal devices except through approved secure channels, and shall promptly report any suspected security incident to the Company.`,
      `Use of unauthorized AI tools, public repositories, or third-party services that may expose Confidential Information is prohibited without written approval.`,
    ]);

    clause('NON-SOLICITATION', [
      `During the term of this Agreement and for twelve (12) months thereafter, the Freelancer shall not directly or indirectly solicit, poach, or encourage any employee, contractor, or client of the Company to terminate or reduce their relationship with the Company.`,
      `The Freelancer shall not solicit the Company’s clients for competing services that arose from introductions or confidential knowledge obtained under this Agreement, for twelve (12) months after termination, except with written consent.`,
    ]);

    clause('REPRESENTATIONS AND WARRANTIES', [
      `The Freelancer represents that they have legal capacity and right to enter this Agreement and to assign Work Product as stated herein.`,
      `Services and deliverables shall be original work of the Freelancer (except approved open-source or third-party components used under compatible licenses disclosed to the Company).`,
      `Deliverables shall not knowingly infringe third-party intellectual property rights or contain malicious code.`,
      `The Freelancer shall not use the Company’s materials in a manner that violates law or third-party rights.`,
    ]);

    clause('INDEMNIFICATION', [
      `The Freelancer shall indemnify, defend, and hold harmless the Company and its directors, officers, and clients from claims, losses, damages, and expenses (including reasonable legal fees) arising from: (a) Freelancer’s negligence or willful misconduct; (b) breach of this Agreement; (c) IP infringement in Work Product (except to the extent caused by Company materials); or (d) unauthorized disclosure of Confidential Information.`,
    ]);

    clause('LIMITATION OF LIABILITY', [
      `Except for breaches of confidentiality, IP assignment, indemnification obligations, or fraud/willful misconduct, neither Party’s aggregate liability under this Agreement shall exceed the total fees paid or payable to the Freelancer in the three (3) months preceding the claim.`,
      `Neither Party shall be liable for indirect, incidental, special, or consequential damages, including lost profits, even if advised of the possibility thereof.`,
    ]);

    clause('TERMINATION', [
      termText,
      `Notice period: ${noticeDays} day(s), unless immediate termination applies.`,
      `Clauses relating to IP, confidentiality, data protection, non-solicitation, indemnification, limitation of liability, and governing law shall survive termination.`,
    ]);

    clause('RETURN OF PROPERTY', [
      `Upon termination or upon request, the Freelancer shall immediately return all Company property, including devices, access cards, documents, keys, and digital assets, and shall revoke or surrender all access credentials.`,
    ]);

    clause('FORCE MAJEURE', [
      `Neither Party shall be liable for delay or failure to perform due to causes beyond reasonable control, including natural disasters, war, pandemic restrictions, government actions, or widespread internet outages, provided the affected Party gives prompt notice and resumes performance when practicable.`,
    ]);

    clause('GOVERNING LAW AND DISPUTE RESOLUTION', [
      `This Agreement shall be governed by the laws of India.`,
      `Courts at the location of the Company’s principal place of business shall have exclusive jurisdiction, subject to the Parties first attempting good-faith negotiation for fifteen (15) days.`,
      `Nothing prevents either Party from seeking interim injunctive relief for IP or confidentiality breaches.`,
    ]);

    clause('GENERAL PROVISIONS', [
      `Entire Agreement: This Agreement constitutes the entire understanding between the Parties and supersedes prior proposals or discussions relating to its subject matter.`,
      `Amendments: No amendment is valid unless made in writing and accepted by both Parties (including digital acceptance).`,
      `Severability: If any provision is held unenforceable, the remaining provisions continue in full force.`,
      `Waiver: Failure to enforce a provision is not a waiver of future enforcement.`,
      `Assignment: The Freelancer may not assign this Agreement without Company consent. The Company may assign to an affiliate or successor.`,
      `Notices: Notices may be sent to the emails stated for each Party and are deemed received on the next business day.`,
      `Counterparts / Electronic Signature: This Agreement may be executed in counterparts and by electronic signature, each of which is deemed an original.`,
    ]);

    if (additionalText) {
      clause('ADDITIONAL TERMS', additionalText);
    }

    if (contract.notes?.trim()) {
      clause('INTERNAL NOTES (COMPANY RECORD)', contract.notes.trim());
    }

    clause(
      'ACKNOWLEDGEMENT',
      `IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date. Each signatory represents that they are authorized to bind the Party they represent. By signing, the Freelancer confirms they have read, understood, and agreed to all terms and conditions of this professional IT services contract.`
    );

    // Signature blocks
    ensureSpace(160);
    y += 8;
    para('SIGNATURES', { bold: true, size: 11 });
    y += 6;

    const sigY = y;
    const colW = (contentW - 24) / 2;

    const drawSigBlock = (x: number, title: string, name: string, extra: string, signed: boolean, signedAt?: Date | null) => {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text(title, x, sigY);
      doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
      doc.text(name || '____________________', x, sigY + 16, { width: colW });
      if (extra) doc.text(extra, x, sigY + 30, { width: colW });
      doc.text('Signature: _______________________', x, sigY + 52);
      doc.text(
        `Date: ${signed && signedAt ? fmtDate(signedAt) : '____________________'}`,
        x,
        sigY + 70
      );
      doc.text(signed ? 'Status: Signed' : 'Status: Pending signature', x, sigY + 88);
    };

    drawSigBlock(
      left,
      'FOR THE COMPANY',
      [contract.companySignatoryName || COMPANY, contract.companySignatoryTitle]
        .filter(Boolean)
        .join('\n'),
      contract.companyEmail || '',
      contract.companySigned,
      contract.companySignedAt || contract.signedAt
    );
    drawSigBlock(
      left + colW + 24,
      'FOR THE FREELANCER',
      FREELANCER,
      contract.freelancerEmail,
      contract.freelancerSigned,
      contract.freelancerSignedAt || contract.signedAt
    );

    y = sigY + 120;
    hr();
    para(
      `Generated on ${new Date().toLocaleString('en-IN')} by ${contract.creator.firstName} ${
        contract.creator.lastName
      }. This document is a confidential commercial contract of ${COMPANY}.`,
      { size: 8, color: MUTED }
    );

    drawFooter();
    doc.end();
  } catch (error) {
    console.error('Contract PDF error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate contract PDF' });
    }
  }
});

// Delete
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.freelancerContract.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) return res.status(404).json({ error: 'Contract not found' });
    await prisma.freelancerContract.delete({ where: { id: existing.id } });
    res.json({ message: 'Contract deleted' });
  } catch (error) {
    console.error('Delete contract error:', error);
    res.status(500).json({ error: 'Failed to delete contract' });
  }
});

export default router;
