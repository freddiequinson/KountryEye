from io import BytesIO
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, A5
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, Flowable
from reportlab.lib.enums import TA_CENTER, TA_RIGHT


# ---------------------------------------------------------------------------
# A5 receipt design shared by the payment receipt and the checkout receipt:
# green curved header with the logo, pill-shaped table header, ruled rows,
# totals on the right, signature line and a contact footer.
# ---------------------------------------------------------------------------
COMPANY_PHONE = "+233 54 848 1866"
COMPANY_EMAIL = "kountryeyecare@gmail.com"

_PAGE_W, _PAGE_H = A5
_MARGIN = 10*mm
_CONTENT_W = _PAGE_W - 2*_MARGIN

_DARK = colors.HexColor('#14472A')
_GREEN = colors.HexColor('#3E8141')
_TINT = colors.HexColor('#DCEEDD')
_INK = colors.HexColor('#16241A')
_DUE = colors.HexColor('#C53030')
_OVER = colors.HexColor('#C05621')

_LABEL = ParagraphStyle('ReceiptLabel', fontName='Helvetica-Bold', fontSize=8, leading=11, textColor=_DARK)
_VALUE = ParagraphStyle('ReceiptValue', fontName='Helvetica', fontSize=9, leading=12, textColor=_INK)
_SMALL = ParagraphStyle('ReceiptSmall', fontName='Helvetica', fontSize=7.5, leading=10.5, textColor=colors.HexColor('#5F6F64'))
_ITEM = ParagraphStyle('ReceiptItem', fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=_INK)
_SIGNER = ParagraphStyle('ReceiptSigner', fontName='Helvetica-Oblique', fontSize=10, leading=13, textColor=_INK, alignment=TA_CENTER)
_SIGN_LABEL = ParagraphStyle('ReceiptSignLabel', fontName='Helvetica-Bold', fontSize=7, leading=10, textColor=_DARK, alignment=TA_CENTER)


def _money(amount) -> str:
    return f"GHS {amount or 0:,.2f}"


def _muted(text) -> str:
    return f'<font color="#5F6F64">{text}</font>'


def _two_lines(first, second=None) -> str:
    return f"{first}<br/>{_muted(second)}" if second else f"{first}"


def _receipt_logo_path():
    import os
    app_dir = os.path.dirname(os.path.dirname(__file__))
    candidates = [
        os.path.join(app_dir, 'static', 'kountry-logo.png'),
        os.path.join(app_dir, 'static', 'logo.png'),
        os.path.join(os.path.dirname(app_dir), '..', 'frontend-chakra', 'public', 'kountry-logo.png'),
        os.path.join(os.path.dirname(app_dir), '..', 'frontend', 'public', 'kountry-logo.png'),
    ]
    return next((path for path in candidates if os.path.exists(path)), None)


def _fill_gradient(canvas, path, x0, x1, start, end):
    canvas.saveState()
    canvas.clipPath(path, stroke=0, fill=0)
    canvas.linearGradient(x0, 0, x1, 0, (start, end))
    canvas.restoreState()


def _draw_receipt_footer(canvas, doc):
    # Rounded green bar with the contact details
    x0, x1, top, r = 7*mm, _PAGE_W - 7*mm, 14*mm, 11*mm
    path = canvas.beginPath()
    path.moveTo(x0, 0)
    path.lineTo(x0, top - r)
    path.arcTo(x0, top - 2*r, x0 + 2*r, top, 180, -90)
    path.lineTo(x1 - r, top)
    path.arcTo(x1 - 2*r, top - 2*r, x1, top, 90, -90)
    path.lineTo(x1, 0)
    path.close()
    _fill_gradient(canvas, path, x0, x1, _DARK, _GREEN)
    canvas.setFillColor(colors.white)
    canvas.setFont('Helvetica', 9)
    canvas.drawCentredString(_PAGE_W / 2, 5.4*mm, f"{COMPANY_PHONE}     |     {COMPANY_EMAIL}")


def _draw_receipt_first_page(canvas, doc):
    # Green block with a rounded bottom-right corner, logo on a white plate
    w, bottom, r = _PAGE_W * 0.66, _PAGE_H - 35*mm, 24*mm
    path = canvas.beginPath()
    path.moveTo(0, _PAGE_H)
    path.lineTo(w, _PAGE_H)
    path.lineTo(w, bottom + r)
    path.arcTo(w - 2*r, bottom, w, bottom + 2*r, 0, -90)
    path.lineTo(0, bottom)
    path.close()
    _fill_gradient(canvas, path, 0, w, _DARK, _GREEN)

    canvas.setFillColor(colors.white)
    logo_path = _receipt_logo_path()
    if logo_path:
        logo_h, logo_w = 13*mm, 13*mm * 1300 / 490
        canvas.roundRect(10*mm, _PAGE_H - 26*mm, logo_w + 7*mm, logo_h + 4*mm, 3*mm, stroke=0, fill=1)
        try:
            canvas.drawImage(logo_path, 13.5*mm, _PAGE_H - 24*mm, width=logo_w, height=logo_h, mask='auto')
        except Exception:
            pass
    else:
        canvas.setFont('Helvetica-Bold', 16)
        canvas.drawString(10*mm, _PAGE_H - 20*mm, "KOUNTRY EYECARE")

    # Two soft pills fading out towards the right edge
    for top, width in ((7*mm, 0.25 * _PAGE_W), (16.5*mm, 0.17 * _PAGE_W)):
        pill = canvas.beginPath()
        pill.roundRect(_PAGE_W - width, _PAGE_H - top - 5*mm, width + 10*mm, 5*mm, 2.5*mm)
        _fill_gradient(canvas, pill, _PAGE_W - width, _PAGE_W, _TINT, colors.white)

    _draw_receipt_footer(canvas, doc)


class _PillHeader(Flowable):
    """Column titles on a rounded green bar: the first is left-aligned, the rest right-aligned over their columns"""
    bar_h = 9*mm

    def __init__(self, titles, col_widths):
        super().__init__()
        self.titles = titles
        self.col_widths = col_widths

    def wrap(self, avail_w, avail_h):
        return _CONTENT_W, self.bar_h

    def draw(self):
        canvas = self.canv
        path = canvas.beginPath()
        path.roundRect(0, 0, _CONTENT_W, self.bar_h, self.bar_h / 2)
        _fill_gradient(canvas, path, 0, _CONTENT_W, _DARK, _GREEN)
        canvas.setFillColor(colors.white)
        canvas.setFont('Helvetica-Bold', 8)
        y = self.bar_h / 2 - 2.8
        canvas.drawString(5*mm, y, self.titles[0])
        x = self.col_widths[0]
        for title, width in zip(self.titles[1:], self.col_widths[1:]):
            x += width
            canvas.drawRightString(x - 4*mm, y, title)


def _details_table(rows):
    """Label/value pairs, two per row: [(label, value_html, label, value_html), ...]"""
    data = [[Paragraph(left, _LABEL), Paragraph(left_value, _VALUE), Paragraph(right, _LABEL) if right else "", Paragraph(right_value, _VALUE) if right_value else ""]
            for left, left_value, right, right_value in rows]
    table = Table(data, colWidths=[18*mm, _CONTENT_W - 18*mm - 13*mm - 32*mm, 13*mm, 32*mm])
    table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (0, -1), 2*mm),
        ('TOPPADDING', (0, 0), (0, -1), 0.6),
        ('TOPPADDING', (2, 0), (2, -1), 0.6),
    ]))
    return table


def _rows_table(rows, col_widths):
    """Ruled rows under a _PillHeader: bold description, then right-aligned figures with a rule before the last column"""
    table = Table([[Paragraph(str(row[0]), _ITEM), *row[1:]] for row in rows], colWidths=col_widths)
    table.setStyle(TableStyle([
        ('FONTNAME', (1, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (1, 0), (-1, -1), 9),
        ('TEXTCOLOR', (1, 0), (-1, -1), _INK),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3*mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3*mm),
        ('LEFTPADDING', (0, 0), (0, -1), 5*mm),
        ('RIGHTPADDING', (1, 0), (-1, -1), 4*mm),
        ('LINEBELOW', (0, 0), (-1, -2), 1.1, _GREEN),
        ('LINEBEFORE', (-1, 0), (-1, -1), 1.1, _GREEN),
    ]))
    return table


def _closing_block(note_html, totals, final_color=_INK):
    """Note on the left; totals on the right with the last row ruled off and emphasised"""
    totals_table = Table(totals, colWidths=[28*mm, 28*mm])
    totals_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -2), 'Helvetica'),
        ('FONTNAME', (1, -1), (1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -2), 9),
        ('FONTSIZE', (0, -1), (-1, -1), 10.5),
        ('TEXTCOLOR', (0, 0), (0, -1), _DARK),
        ('TEXTCOLOR', (1, 0), (1, -1), _INK),
        ('TEXTCOLOR', (1, -1), (1, -1), final_color),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, -2), (-1, -2), 7),
        ('TOPPADDING', (0, -1), (-1, -1), 7),
        ('LINEABOVE', (0, -1), (-1, -1), 1.1, _GREEN),
    ]))
    block = Table([[Paragraph(note_html, _SMALL), totals_table]], colWidths=[_CONTENT_W - 56*mm - 4*mm, 56*mm + 4*mm])
    block.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (0, 0), 2*mm),
        ('RIGHTPADDING', (0, 0), (0, 0), 8*mm),
        ('LEFTPADDING', (1, 0), (1, 0), 0),
        ('RIGHTPADDING', (1, 0), (1, 0), 4*mm),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))
    return block


def _signature_block(name):
    """Authorised sign: the account behind the receipt, for auditing"""
    sign = Table([[Paragraph(name, _SIGNER)], [Paragraph("AUTHORISED SIGN", _SIGN_LABEL)]], colWidths=[40*mm])
    sign.setStyle(TableStyle([
        ('LINEABOVE', (0, 1), (0, 1), 0.8, _INK),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    row = Table([["", sign]], colWidths=[_CONTENT_W - 60*mm, 60*mm])
    row.setStyle(TableStyle([('ALIGN', (1, 0), (1, 0), 'CENTER'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0)]))
    return row


def _build_receipt(elements, title) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        # The frame pads its content by 6pt a side; take that off the margins so content is exactly _CONTENT_W wide
        buffer, pagesize=A5, leftMargin=_MARGIN - 6, rightMargin=_MARGIN - 6, topMargin=12*mm, bottomMargin=20*mm,
        title=title,
    )
    # The first Spacer clears the header drawn on page one
    doc.build([Spacer(1, 30*mm), *elements], onFirstPage=_draw_receipt_first_page, onLaterPages=_draw_receipt_footer)
    return buffer.getvalue()


def _printed_note() -> str:
    return f"Thank you for choosing Kountry Eyecare. Please keep this receipt for your records.<br/><br/>Printed {datetime.now().strftime('%d %b %Y, %I:%M %p')}"


def generate_receipt_pdf(receipt_data: dict) -> BytesIO:
    """Payment receipt (visit, prescription or sale) in the A5 receipt design"""
    patient_number = receipt_data.get("patient_number")
    details = _details_table([
        ("RECEIPT", _two_lines(f"N° {receipt_data.get('receipt_number', 'N/A')}", receipt_data.get("branch")),
         "DATE", receipt_data.get("date", datetime.now().strftime("%Y-%m-%d %H:%M"))),
        ("PATIENT", _two_lines(receipt_data.get("patient_name", "N/A"), patient_number if patient_number and patient_number != "N/A" else None), None, None),
    ])

    col_widths = [_CONTENT_W - 26*mm - 14*mm - 28*mm, 26*mm, 14*mm, 28*mm]
    elements = [details, Spacer(1, 4*mm), _PillHeader(("ITEM", "PRICE", "QTY", "TOTAL"), col_widths)]
    items = receipt_data.get("items", [])
    if items:
        elements.append(_rows_table(
            [[item.get("name", ""), _money(item.get("unit_price", 0)), str(item.get("quantity", 1)), _money(item.get("quantity", 1) * item.get("unit_price", 0))] for item in items],
            col_widths,
        ))
    elements.append(Spacer(1, 6*mm))

    subtotal = receipt_data.get("subtotal", 0)
    discount = receipt_data.get("discount", 0)
    total = receipt_data.get("total", subtotal - discount)
    amount_paid = receipt_data.get("amount_paid", total)
    balance_due = total - amount_paid

    totals = [["SUB TOTAL", _money(subtotal)]]
    if discount > 0:
        totals.append(["DISCOUNT", f"-{_money(discount)}"])
    totals.append(["TOTAL", _money(total)])
    final_color = _INK
    if balance_due > 0:
        totals += [["AMOUNT PAID", _money(amount_paid)], ["BALANCE DUE", _money(balance_due)]]
        final_color = _DUE
    elif balance_due < 0:
        # Overpayments are accepted; print the extra so it is returned or credited rather than lost
        totals += [["AMOUNT PAID", _money(amount_paid)], ["OVERPAID", _money(-balance_due)]]
        final_color = _OVER
    else:
        totals.append(["AMOUNT PAID", _money(amount_paid)])

    note = f"<b>Payment method:</b> {str(receipt_data.get('payment_method') or 'Cash').replace('_', ' ').title()}<br/>"
    if receipt_data.get("reference"):
        note += f"<b>Reference:</b> {receipt_data.get('reference')}<br/>"
    elements.append(_closing_block(f"{note}<br/>{_printed_note()}", totals, final_color))

    if receipt_data.get("served_by"):
        elements += [Spacer(1, 9*mm), _signature_block(receipt_data.get("served_by"))]

    return BytesIO(_build_receipt(elements, f"Receipt {receipt_data.get('receipt_number', '')}".strip()))


def generate_prescription_pdf(prescription_data: dict) -> BytesIO:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=20*mm, leftMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)
    
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='Center', alignment=TA_CENTER))
    
    elements = []
    
    elements.append(Paragraph("<b>KOUNTRY EYECARE</b>", styles['Title']))
    elements.append(Paragraph("Medical Prescription", styles['Center']))
    elements.append(Spacer(1, 10*mm))
    
    patient_info = [
        ["Patient:", prescription_data.get("patient_name", "N/A")],
        ["Patient ID:", prescription_data.get("patient_number", "N/A")],
        ["Date:", prescription_data.get("date", datetime.now().strftime("%Y-%m-%d"))],
        ["Prescribed by:", prescription_data.get("doctor_name", "N/A")],
    ]
    
    info_table = Table(patient_info, colWidths=[50*mm, 110*mm])
    info_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 10*mm))
    
    if prescription_data.get("spectacle_rx"):
        elements.append(Paragraph("<b>Spectacle Prescription</b>", styles['Heading3']))
        rx = prescription_data["spectacle_rx"]
        rx_data = [
            ["", "Sphere", "Cylinder", "Axis", "Add", "PD"],
            ["OD (Right)", rx.get("sphere_od", ""), rx.get("cylinder_od", ""), rx.get("axis_od", ""), rx.get("add", ""), rx.get("pd", "")],
            ["OS (Left)", rx.get("sphere_os", ""), rx.get("cylinder_os", ""), rx.get("axis_os", ""), "", ""],
        ]
        rx_table = Table(rx_data, colWidths=[30*mm, 25*mm, 25*mm, 25*mm, 25*mm, 25*mm])
        rx_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.298, 0.608, 0.310)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        elements.append(rx_table)
        elements.append(Spacer(1, 10*mm))
    
    items = prescription_data.get("items", [])
    if items:
        elements.append(Paragraph("<b>Medications / Items</b>", styles['Heading3']))
        for i, item in enumerate(items, 1):
            elements.append(Paragraph(f"<b>{i}. {item.get('name', '')}</b>", styles['Normal']))
            if item.get("dosage"):
                elements.append(Paragraph(f"   Dosage: {item.get('dosage')}", styles['Normal']))
            if item.get("duration"):
                elements.append(Paragraph(f"   Duration: {item.get('duration')}", styles['Normal']))
            if item.get("description"):
                elements.append(Paragraph(f"   Instructions: {item.get('description')}", styles['Normal']))
            elements.append(Spacer(1, 3*mm))
    
    elements.append(Spacer(1, 15*mm))
    elements.append(Paragraph("_" * 40, styles['Normal']))
    elements.append(Paragraph("Doctor's Signature", styles['Normal']))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_checkout_receipt_pdf(visit, patient, summary: dict, branch=None, issued_by=None) -> bytes:
    """Generate unified checkout receipt PDF with all visit charges (A5 receipt design)"""
    branch_line = ", ".join(part for part in (getattr(branch, 'name', None), getattr(branch, 'address', None)) if part) if branch else ""
    patient_line = "  ·  ".join(part for part in (patient.patient_number, patient.phone) if part)
    details = _details_table([
        ("VISIT", _two_lines(f"N° {visit.visit_number or 'N/A'}", branch_line),
         "DATE", _two_lines(visit.visit_date.strftime("%d %b %Y"), visit.visit_date.strftime("%I:%M %p")) if visit.visit_date else "N/A"),
        ("PATIENT", _two_lines(f"{patient.first_name} {patient.last_name}", patient_line), None, None),
    ])

    # Charges
    charges = summary.get("charges", {})
    rows = []

    consultation = charges.get("consultation", {})
    if consultation.get("fee", 0) > 0:
        description = f"Consultation - {consultation.get('type')}" if consultation.get("type") else "Consultation Fee"
        rows.append([description, consultation.get('fee', 0), consultation.get('paid', 0), consultation.get('balance', 0)])

    for scan in charges.get("scans", {}).get("items", []):
        rows.append([
            f"Scan - {scan.get('scan_type', '').upper()} ({scan.get('scan_number', '')})",
            scan.get('amount', 0), scan.get('paid', 0), scan.get('amount', 0) - scan.get('paid', 0),
        ])

    for product in charges.get("products", {}).get("items", []):
        rows.append([f"{product.get('product_name', 'Product')} x{product.get('quantity', 1)}", product.get('total', 0), product.get('total', 0), 0])

    col_widths = [_CONTENT_W - 3 * 24*mm, 24*mm, 24*mm, 24*mm]
    elements = [details, Spacer(1, 4*mm), _PillHeader(("DESCRIPTION", "AMOUNT", "PAID", "BALANCE"), col_widths)]
    if rows:
        elements.append(_rows_table([[description, _money(amount), _money(paid), _money(balance)] for description, amount, paid, balance in rows], col_widths))
    elements.append(Spacer(1, 6*mm))

    totals = summary.get("summary", {})
    balance_due = totals.get('balance_due', 0) or 0
    elements.append(_closing_block(
        _printed_note(),
        [
            # Product rows above are base prices; the VAT charged on them is part of the grand total
            ["VAT", _money(totals.get('vat_total', 0))],
            ["GRAND TOTAL", _money(totals.get('grand_total', 0))],
            ["TOTAL PAID", _money(totals.get('total_paid', 0))],
            ["BALANCE DUE", _money(balance_due)],
        ],
        _DUE if balance_due > 0 else _INK,
    ))

    # Signed with the account that issued the receipt
    if issued_by:
        elements += [Spacer(1, 9*mm), _signature_block(issued_by)]

    return _build_receipt(elements, f"Checkout receipt {visit.visit_number or ''}".strip())


def generate_spectacles_prescription_pdf(prescription_data: dict) -> bytes:
    """Generate a spectacles prescription form PDF matching the template"""
    import os
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=15*mm, leftMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm)
    
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='CenterTitle', alignment=TA_CENTER, fontSize=18, fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle(name='CenterSubtitle', alignment=TA_CENTER, fontSize=10))
    styles.add(ParagraphStyle(name='FormTitle', alignment=TA_CENTER, fontSize=12, fontName='Helvetica-Bold', spaceAfter=10))
    styles.add(ParagraphStyle(name='SmallText', fontSize=9))
    styles.add(ParagraphStyle(name='SignatureLine', fontSize=10, spaceBefore=20))
    
    elements = []
    
    # Header with logo
    logo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'kountry-logo.png')
    if os.path.exists(logo_path):
        try:
            logo = Image(logo_path, width=40*mm, height=15*mm)
            logo.hAlign = 'CENTER'
            elements.append(logo)
            elements.append(Spacer(1, 3*mm))
        except Exception:
            pass
    
    # Company header
    elements.append(Paragraph("<b>KOUNTRY EYECARE</b>", styles['CenterTitle']))
    branch_address = prescription_data.get('branch_address', 'GOIL FUEL STATION - BASKET, SPINTEX RD, ACCRA')
    branch_phone = prescription_data.get('branch_phone', '0548503833 / 0548481866')
    elements.append(Paragraph(branch_address, styles['CenterSubtitle']))
    elements.append(Paragraph(branch_phone, styles['CenterSubtitle']))
    elements.append(Spacer(1, 8*mm))
    
    # Form title
    elements.append(Paragraph("<b>SPECTACLES PRESCRIPTION FORM</b>", styles['FormTitle']))
    elements.append(Spacer(1, 5*mm))
    
    # Patient info section
    patient = prescription_data.get('patient', {})
    patient_name = patient.get('name', '')
    patient_age = patient.get('age', '')
    patient_sex = patient.get('sex', '')
    patient_phone = patient.get('phone', '')
    patient_type = prescription_data.get('patient_type', 'New')
    visioncare_member = prescription_data.get('visioncare_member', False)
    prescription_date = prescription_data.get('date', datetime.now().strftime('%Y-%m-%d'))
    
    # Patient info table
    patient_info = [
        [Paragraph("<b>Patient Name:</b>", styles['SmallText']), patient_name, 
         Paragraph("<b>Date:</b>", styles['SmallText']), prescription_date],
        [Paragraph("<b>Age:</b>", styles['SmallText']), patient_age,
         Paragraph("<b>Sex:</b>", styles['SmallText']), patient_sex,
         Paragraph("<b>Phone:</b>", styles['SmallText']), patient_phone],
        [Paragraph("<b>Patient Type:</b>", styles['SmallText']), 
         f"{'☑' if patient_type == 'New' else '☐'} New    {'☑' if patient_type == 'Returning' else '☐'} Returning",
         Paragraph("<b>VisionCare Member:</b>", styles['SmallText']),
         f"{'☑' if visioncare_member else '☐'} Yes    {'☑' if not visioncare_member else '☐'} No"],
    ]
    
    patient_table = Table(patient_info, colWidths=[25*mm, 55*mm, 30*mm, 25*mm, 15*mm, 30*mm])
    patient_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(patient_table)
    elements.append(Spacer(1, 8*mm))
    
    # Prescription table (Eye, SPH, CYL, AXIS, VA)
    green_color = colors.HexColor('#4CAF50')
    
    rx_header = [
        Paragraph("<b>Eye</b>", styles['SmallText']),
        Paragraph("<b>SPH</b>", styles['SmallText']),
        Paragraph("<b>CYL</b>", styles['SmallText']),
        Paragraph("<b>AXIS</b>", styles['SmallText']),
        Paragraph("<b>VA</b>", styles['SmallText']),
    ]
    
    rx_data = [
        rx_header,
        ["Right (OD)", prescription_data.get('sphere_od', ''), prescription_data.get('cylinder_od', ''), 
         prescription_data.get('axis_od', ''), prescription_data.get('va_od', '')],
        ["Left (OS)", prescription_data.get('sphere_os', ''), prescription_data.get('cylinder_os', ''), 
         prescription_data.get('axis_os', ''), prescription_data.get('va_os', '')],
        ["Add (Near)", prescription_data.get('add_power', ''), '', '', ''],
    ]
    
    rx_table = Table(rx_data, colWidths=[30*mm, 35*mm, 35*mm, 35*mm, 35*mm])
    rx_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('BACKGROUND', (0, 0), (-1, 0), green_color),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(rx_table)
    elements.append(Spacer(1, 8*mm))
    
    # PD and Segment Height, Lens Type, Lens Material, Coating
    lens_type = prescription_data.get('lens_type', '')
    lens_material = prescription_data.get('lens_material', '')
    lens_coating = prescription_data.get('lens_coating', '')
    
    specs_data = [
        [Paragraph("<b>PD (mm):</b>", styles['SmallText']), prescription_data.get('pd', ''),
         Paragraph("<b>Segment Height:</b>", styles['SmallText']), prescription_data.get('segment_height', '')],
        [Paragraph("<b>Lens Type:</b>", styles['SmallText']), 
         f"{'☑' if lens_type == 'SV' else '☐'} SV    {'☑' if lens_type == 'Bifocal' else '☐'} Bifocal    {'☑' if lens_type == 'Progressive' else '☐'} Progressive",
         Paragraph("<b>Lens Material:</b>", styles['SmallText']),
         f"{'☑' if lens_material == 'CR-39' else '☐'} CR-39    {'☑' if lens_material == 'Poly' else '☐'} Poly    {'☑' if lens_material == 'Hi-index' else '☐'} Hi-index"],
        [Paragraph("<b>Coating:</b>", styles['SmallText']),
         f"{'☑' if lens_coating == 'ARC' else '☐'} ARC    {'☑' if lens_coating == 'Blue-cut' else '☐'} Blue-cut    {'☑' if lens_coating == 'Photochromic' else '☐'} Photochromic",
         "",
         f"{'☑' if lens_coating == 'None' else '☐'} None    {'☑' if lens_coating == 'Fashion' else '☐'} Fashion    {'☑' if lens_coating == 'Sun' else '☐'} Sun"],
    ]
    
    specs_table = Table(specs_data, colWidths=[25*mm, 60*mm, 30*mm, 65*mm])
    specs_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(specs_table)
    elements.append(Spacer(1, 8*mm))
    
    # Frame info and dispensing
    frame_data = [
        [Paragraph("<b>Frame Code:</b>", styles['SmallText']), prescription_data.get('frame_code', ''),
         Paragraph("<b>Frame Size:</b>", styles['SmallText']), prescription_data.get('frame_size', '')],
        [Paragraph("<b>Dispensed By:</b>", styles['SmallText']), prescription_data.get('dispensed_by_name', ''),
         Paragraph("<b>Delivery Date:</b>", styles['SmallText']), prescription_data.get('delivery_date', '')],
        [Paragraph("<b>Remarks:</b>", styles['SmallText']), prescription_data.get('remarks', ''), '', ''],
    ]
    
    frame_table = Table(frame_data, colWidths=[30*mm, 60*mm, 30*mm, 60*mm])
    frame_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('SPAN', (1, 2), (3, 2)),  # Remarks spans across
    ]))
    elements.append(frame_table)
    elements.append(Spacer(1, 15*mm))
    
    # Signature section
    optometrist_name = prescription_data.get('optometrist_name', '')
    elements.append(Paragraph(f"<b>Optometrist Name:</b> {'_' * 40 if not optometrist_name else optometrist_name}", styles['SignatureLine']))
    elements.append(Spacer(1, 10*mm))
    
    sig_data = [
        [Paragraph("<b>Signature:</b> _________________________", styles['SmallText']),
         Paragraph(f"<b>Date:</b> {prescription_date}", styles['SmallText'])],
    ]
    sig_table = Table(sig_data, colWidths=[90*mm, 90*mm])
    elements.append(sig_table)
    
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
