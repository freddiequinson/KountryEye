from io import BytesIO
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT


def generate_receipt_pdf(receipt_data: dict) -> BytesIO:
    import os
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=20*mm, leftMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)
    
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='Center', alignment=TA_CENTER))
    styles.add(ParagraphStyle(name='Right', alignment=TA_RIGHT))
    
    elements = []
    
    # Try to add logo if it exists
    logo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'logo.png')
    if os.path.exists(logo_path):
        try:
            logo = Image(logo_path, width=50*mm, height=20*mm)
            logo.hAlign = 'CENTER'
            elements.append(logo)
            elements.append(Spacer(1, 5*mm))
        except Exception:
            pass
    
    elements.append(Paragraph("<b>KOUNTRY EYECARE</b>", styles['Title']))
    elements.append(Paragraph("Integrated Clinic Management System", styles['Center']))
    elements.append(Spacer(1, 10*mm))
    
    elements.append(Paragraph(f"<b>RECEIPT</b>", styles['Center']))
    elements.append(Spacer(1, 5*mm))
    
    receipt_info = [
        ["Receipt No:", receipt_data.get("receipt_number", "N/A")],
        ["Date:", receipt_data.get("date", datetime.now().strftime("%Y-%m-%d %H:%M"))],
        ["Branch:", receipt_data.get("branch", "Main Branch")],
    ]
    
    info_table = Table(receipt_info, colWidths=[50*mm, 100*mm])
    info_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 5*mm))
    
    patient_info = [
        ["Patient:", receipt_data.get("patient_name", "N/A")],
        ["Patient ID:", receipt_data.get("patient_number", "N/A")],
    ]
    
    patient_table = Table(patient_info, colWidths=[50*mm, 100*mm])
    patient_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(patient_table)
    elements.append(Spacer(1, 10*mm))
    
    items = receipt_data.get("items", [])
    if items:
        item_data = [["Item", "Qty", "Unit Price", "Total"]]
        for item in items:
            item_data.append([
                item.get("name", ""),
                str(item.get("quantity", 1)),
                f"GHS {item.get('unit_price', 0):,.2f}",
                f"GHS {item.get('quantity', 1) * item.get('unit_price', 0):,.2f}"
            ])
        
        items_table = Table(item_data, colWidths=[70*mm, 20*mm, 35*mm, 35*mm])
        items_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.298, 0.608, 0.310)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        elements.append(items_table)
    
    elements.append(Spacer(1, 5*mm))
    
    subtotal = receipt_data.get("subtotal", 0)
    discount = receipt_data.get("discount", 0)
    total = receipt_data.get("total", subtotal - discount)
    
    totals_data = [
        ["Subtotal:", f"GHS {subtotal:,.2f}"],
        ["Discount:", f"GHS {discount:,.2f}"],
        ["Total:", f"GHS {total:,.2f}"],
    ]
    
    totals_table = Table(totals_data, colWidths=[120*mm, 40*mm])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('FONTNAME', (0, 2), (-1, 2), 'Helvetica-Bold'),
        ('LINEABOVE', (0, 2), (-1, 2), 1, colors.black),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 10*mm))
    
    amount_paid = receipt_data.get('amount_paid', total)
    balance_due = total - amount_paid
    
    payment_info = [
        ["Payment Method:", receipt_data.get("payment_method", "Cash").title()],
        ["Amount Paid:", f"GHS {amount_paid:,.2f}"],
    ]
    
    if balance_due > 0:
        payment_info.append(["Balance Due:", f"GHS {balance_due:,.2f}"])
    
    if receipt_data.get("reference"):
        payment_info.append(["Reference:", receipt_data.get("reference")])
    
    payment_table = Table(payment_info, colWidths=[50*mm, 100*mm])
    payment_style = [
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]
    # Highlight balance due row in red if there's a deficit
    if balance_due > 0:
        balance_row_idx = 2  # Balance Due is the 3rd row (index 2)
        payment_style.append(('TEXTCOLOR', (0, balance_row_idx), (-1, balance_row_idx), colors.red))
        payment_style.append(('FONTNAME', (0, balance_row_idx), (-1, balance_row_idx), 'Helvetica-Bold'))
    payment_table.setStyle(TableStyle(payment_style))
    elements.append(payment_table)
    elements.append(Spacer(1, 15*mm))
    
    elements.append(Paragraph("Thank you for choosing Kountry Eyecare!", styles['Center']))
    elements.append(Paragraph("Your vision is our priority.", styles['Center']))
    elements.append(Spacer(1, 10*mm))
    
    elements.append(Paragraph(f"Served by: {receipt_data.get('served_by', 'Staff')}", styles['Center']))
    elements.append(Paragraph(f"Printed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Center']))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer


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


COMPANY_PHONE = "+233 54 848 1866"
COMPANY_EMAIL = "kountryeyecare@gmail.com"


def generate_checkout_receipt_pdf(visit, patient, summary: dict, branch=None, issued_by=None) -> bytes:
    """Generate unified checkout receipt PDF with all visit charges (A5, same design as the sales receipt)"""
    import os
    from reportlab.lib.pagesizes import A5
    from reportlab.platypus import Flowable

    page_w, page_h = A5
    margin = 10*mm
    content_w = page_w - 2*margin

    DARK = colors.HexColor('#14472A')
    GREEN = colors.HexColor('#3E8141')
    TINT = colors.HexColor('#DCEEDD')
    INK = colors.HexColor('#16241A')
    MUTED = colors.HexColor('#5F6F64')
    DUE = colors.HexColor('#C53030')

    app_dir = os.path.dirname(os.path.dirname(__file__))
    logo_paths = [
        os.path.join(app_dir, 'static', 'kountry-logo.png'),
        os.path.join(app_dir, 'static', 'logo.png'),
        os.path.join(os.path.dirname(app_dir), '..', 'frontend-chakra', 'public', 'kountry-logo.png'),
        os.path.join(os.path.dirname(app_dir), '..', 'frontend', 'public', 'kountry-logo.png'),
    ]
    logo_path = next((path for path in logo_paths if os.path.exists(path)), None)

    def fill_gradient(canvas, path, x0, x1, start, end):
        canvas.saveState()
        canvas.clipPath(path, stroke=0, fill=0)
        canvas.linearGradient(x0, 0, x1, 0, (start, end))
        canvas.restoreState()

    def draw_footer(canvas, doc):
        # Rounded green bar with the contact details
        x0, x1, top, r = 7*mm, page_w - 7*mm, 14*mm, 11*mm
        path = canvas.beginPath()
        path.moveTo(x0, 0)
        path.lineTo(x0, top - r)
        path.arcTo(x0, top - 2*r, x0 + 2*r, top, 180, -90)
        path.lineTo(x1 - r, top)
        path.arcTo(x1 - 2*r, top - 2*r, x1, top, 90, -90)
        path.lineTo(x1, 0)
        path.close()
        fill_gradient(canvas, path, x0, x1, DARK, GREEN)
        canvas.setFillColor(colors.white)
        canvas.setFont('Helvetica', 9)
        canvas.drawCentredString(page_w / 2, 5.4*mm, f"{COMPANY_PHONE}     |     {COMPANY_EMAIL}")

    def draw_first_page(canvas, doc):
        # Green block with a rounded bottom-right corner, logo on a white plate
        w, bottom, r = page_w * 0.66, page_h - 35*mm, 24*mm
        path = canvas.beginPath()
        path.moveTo(0, page_h)
        path.lineTo(w, page_h)
        path.lineTo(w, bottom + r)
        path.arcTo(w - 2*r, bottom, w, bottom + 2*r, 0, -90)
        path.lineTo(0, bottom)
        path.close()
        fill_gradient(canvas, path, 0, w, DARK, GREEN)

        canvas.setFillColor(colors.white)
        if logo_path:
            logo_h, logo_w = 13*mm, 13*mm * 1300 / 490
            canvas.roundRect(10*mm, page_h - 26*mm, logo_w + 7*mm, logo_h + 4*mm, 3*mm, stroke=0, fill=1)
            try:
                canvas.drawImage(logo_path, 13.5*mm, page_h - 24*mm, width=logo_w, height=logo_h, mask='auto')
            except Exception:
                pass
        else:
            canvas.setFont('Helvetica-Bold', 16)
            canvas.drawString(10*mm, page_h - 20*mm, "KOUNTRY EYECARE")

        # Two soft pills fading out towards the right edge
        for top, width in ((7*mm, 0.25 * page_w), (16.5*mm, 0.17 * page_w)):
            pill = canvas.beginPath()
            pill.roundRect(page_w - width, page_h - top - 5*mm, width + 10*mm, 5*mm, 2.5*mm)
            fill_gradient(canvas, pill, page_w - width, page_w, TINT, colors.white)

        draw_footer(canvas, doc)

    col_widths = [content_w - 3 * 24*mm, 24*mm, 24*mm, 24*mm]

    class PillHeader(Flowable):
        """Column titles on a rounded green bar"""
        bar_h = 9*mm

        def wrap(self, avail_w, avail_h):
            return content_w, self.bar_h

        def draw(self):
            canvas = self.canv
            path = canvas.beginPath()
            path.roundRect(0, 0, content_w, self.bar_h, self.bar_h / 2)
            fill_gradient(canvas, path, 0, content_w, DARK, GREEN)
            canvas.setFillColor(colors.white)
            canvas.setFont('Helvetica-Bold', 8)
            y = self.bar_h / 2 - 2.8
            canvas.drawString(5*mm, y, "DESCRIPTION")
            x = col_widths[0]
            for title, width in zip(("AMOUNT", "PAID", "BALANCE"), col_widths[1:]):
                x += width
                canvas.drawRightString(x - 4*mm, y, title)

    label = ParagraphStyle('CheckoutLabel', fontName='Helvetica-Bold', fontSize=8, leading=11, textColor=DARK)
    value = ParagraphStyle('CheckoutValue', fontName='Helvetica', fontSize=9, leading=12, textColor=INK)
    small = ParagraphStyle('CheckoutSmall', fontName='Helvetica', fontSize=7.5, leading=10.5, textColor=MUTED)
    item = ParagraphStyle('CheckoutItem', fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=INK)

    def money(amount) -> str:
        return f"GHS {amount or 0:,.2f}"

    def muted(text) -> str:
        return f'<font color="#5F6F64">{text}</font>'

    elements = [Spacer(1, 30*mm)]

    # Visit & patient details
    branch_line = ", ".join(part for part in (getattr(branch, 'name', None), getattr(branch, 'address', None)) if part) if branch else ""
    patient_line = "  ·  ".join(part for part in (patient.patient_number, patient.phone) if part)
    visit_date = visit.visit_date.strftime("%d %b %Y") if visit.visit_date else "N/A"
    visit_time = visit.visit_date.strftime("%I:%M %p") if visit.visit_date else ""
    details = Table(
        [
            [Paragraph("VISIT", label), Paragraph(f"N° {visit.visit_number or 'N/A'}" + (f"<br/>{muted(branch_line)}" if branch_line else ""), value),
             Paragraph("DATE", label), Paragraph(visit_date + (f"<br/>{muted(visit_time)}" if visit_time else ""), value)],
            [Paragraph("PATIENT", label), Paragraph(f"{patient.first_name} {patient.last_name}" + (f"<br/>{muted(patient_line)}" if patient_line else ""), value), "", ""],
        ],
        colWidths=[18*mm, content_w - 18*mm - 13*mm - 32*mm, 13*mm, 32*mm],
    )
    details.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (0, -1), 2*mm),
        ('TOPPADDING', (0, 0), (0, -1), 0.6),
        ('TOPPADDING', (2, 0), (2, -1), 0.6),
    ]))
    elements.append(details)
    elements.append(Spacer(1, 4*mm))

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

    elements.append(PillHeader())
    if rows:
        charges_table = Table(
            [[Paragraph(description, item), money(amount), money(paid), money(balance)] for description, amount, paid, balance in rows],
            colWidths=col_widths,
        )
        charges_table.setStyle(TableStyle([
            ('FONTNAME', (1, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (1, 0), (-1, -1), 9),
            ('TEXTCOLOR', (1, 0), (-1, -1), INK),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 3*mm),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3*mm),
            ('LEFTPADDING', (0, 0), (0, -1), 5*mm),
            ('RIGHTPADDING', (1, 0), (-1, -1), 4*mm),
            ('LINEBELOW', (0, 0), (-1, -2), 1.1, GREEN),
            ('LINEBEFORE', (-1, 0), (-1, -1), 1.1, GREEN),
        ]))
        elements.append(charges_table)
    elements.append(Spacer(1, 6*mm))

    # Totals on the right, note on the left
    totals = summary.get("summary", {})
    balance_due = totals.get('balance_due', 0) or 0
    totals_table = Table(
        [
            # Product rows above are base prices; the VAT charged on them is part of the grand total
            ["VAT", money(totals.get('vat_total', 0))],
            ["GRAND TOTAL", money(totals.get('grand_total', 0))],
            ["TOTAL PAID", money(totals.get('total_paid', 0))],
            ["BALANCE DUE", money(balance_due)],
        ],
        colWidths=[28*mm, 28*mm],
    )
    totals_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -2), 'Helvetica'),
        ('FONTNAME', (1, -1), (1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -2), 9),
        ('FONTSIZE', (0, -1), (-1, -1), 10.5),
        ('TEXTCOLOR', (0, 0), (0, -1), DARK),
        ('TEXTCOLOR', (1, 0), (1, -1), INK),
        ('TEXTCOLOR', (1, -1), (1, -1), DUE if balance_due > 0 else INK),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, -2), (-1, -2), 7),
        ('TOPPADDING', (0, -1), (-1, -1), 7),
        ('LINEABOVE', (0, -1), (-1, -1), 1.1, GREEN),
    ]))
    note = Paragraph(
        f"Thank you for choosing Kountry Eyecare. Please keep this receipt for your records.<br/><br/>Printed {datetime.now().strftime('%d %b %Y, %I:%M %p')}",
        small,
    )
    closing = Table([[note, totals_table]], colWidths=[content_w - 56*mm - 4*mm, 56*mm + 4*mm])
    closing.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (0, 0), 2*mm),
        ('RIGHTPADDING', (0, 0), (0, 0), 8*mm),
        ('LEFTPADDING', (1, 0), (1, 0), 0),
        ('RIGHTPADDING', (1, 0), (1, 0), 4*mm),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(closing)

    # Authorised sign: the account that issued the receipt, for auditing
    if issued_by:
        signer = ParagraphStyle('CheckoutSigner', fontName='Helvetica-Oblique', fontSize=10, leading=13, textColor=INK, alignment=TA_CENTER)
        sign_label = ParagraphStyle('CheckoutSignLabel', fontName='Helvetica-Bold', fontSize=7, leading=10, textColor=DARK, alignment=TA_CENTER)
        sign = Table([[Paragraph(issued_by, signer)], [Paragraph("AUTHORISED SIGN", sign_label)]], colWidths=[40*mm])
        sign.setStyle(TableStyle([
            ('LINEABOVE', (0, 1), (0, 1), 0.8, INK),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        sign_row = Table([["", sign]], colWidths=[content_w - 60*mm, 60*mm])
        sign_row.setStyle(TableStyle([('ALIGN', (1, 0), (1, 0), 'CENTER'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0)]))
        elements.append(Spacer(1, 9*mm))
        elements.append(sign_row)

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        # The frame pads its content by 6pt a side; take that off the margins so content is exactly content_w wide
        buffer, pagesize=A5, leftMargin=margin - 6, rightMargin=margin - 6, topMargin=12*mm, bottomMargin=20*mm,
        title=f"Checkout receipt {visit.visit_number or ''}".strip(),
    )
    doc.build(elements, onFirstPage=draw_first_page, onLaterPages=draw_footer)
    return buffer.getvalue()


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
