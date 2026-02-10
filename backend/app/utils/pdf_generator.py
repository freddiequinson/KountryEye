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


def generate_checkout_receipt_pdf(visit, patient, summary: dict, branch=None) -> bytes:
    """Generate unified checkout receipt PDF with all visit charges"""
    import os
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=20*mm, leftMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)
    
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='CenterCheckout', alignment=TA_CENTER))
    styles.add(ParagraphStyle(name='RightCheckout', alignment=TA_RIGHT))
    
    elements = []
    
    # Kountry Eyecare brand colors
    KOUNTRY_GREEN = colors.HexColor('#4c9b4f')
    KOUNTRY_LIGHT_GREEN = colors.HexColor('#e8f5e9')
    
    # Try to add logo - check multiple possible locations
    logo_paths = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '..', 'frontend', 'public', 'kountry-logo.png'),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'kountry-logo.png'),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'logo.png'),
    ]
    
    logo_added = False
    for logo_path in logo_paths:
        if os.path.exists(logo_path):
            try:
                logo = Image(logo_path, width=50*mm, height=20*mm)
                logo.hAlign = 'CENTER'
                elements.append(logo)
                elements.append(Spacer(1, 5*mm))
                logo_added = True
                break
            except Exception:
                continue
    
    # Header - only show text if logo wasn't added
    if not logo_added:
        elements.append(Paragraph("<b>KOUNTRY EYECARE</b>", styles['Title']))
    if branch:
        elements.append(Paragraph(f"{branch.name}", styles['CenterCheckout']))
        if branch.address:
            elements.append(Paragraph(f"{branch.address}", styles['CenterCheckout']))
        if branch.phone:
            elements.append(Paragraph(f"Tel: {branch.phone}", styles['CenterCheckout']))
    elements.append(Spacer(1, 10*mm))
    
    elements.append(Paragraph("<b>CHECKOUT RECEIPT</b>", styles['CenterCheckout']))
    elements.append(Spacer(1, 5*mm))
    
    # Visit & Patient Info
    visit_info = [
        ["Visit No:", visit.visit_number or "N/A"],
        ["Date:", visit.visit_date.strftime("%Y-%m-%d %H:%M") if visit.visit_date else "N/A"],
        ["Patient:", f"{patient.first_name} {patient.last_name}"],
        ["Patient No:", patient.patient_number or "N/A"],
        ["Phone:", patient.phone or "N/A"],
    ]
    
    info_table = Table(visit_info, colWidths=[40*mm, 110*mm])
    info_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.grey),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 10*mm))
    
    # Charges breakdown
    elements.append(Paragraph("<b>CHARGES BREAKDOWN</b>", styles['Heading3']))
    elements.append(Spacer(1, 3*mm))
    
    charges = summary.get("charges", {})
    
    # Build items table
    table_data = [["Description", "Amount", "Paid", "Balance"]]
    
    # Consultation
    consultation = charges.get("consultation", {})
    if consultation.get("fee", 0) > 0:
        consultation_desc = "Consultation Fee"
        if consultation.get("type"):
            consultation_desc = f"Consultation - {consultation.get('type')}"
        table_data.append([
            consultation_desc,
            f"GHS {consultation.get('fee', 0):,.2f}",
            f"GHS {consultation.get('paid', 0):,.2f}",
            f"GHS {consultation.get('balance', 0):,.2f}"
        ])
    
    # Scans
    scans = charges.get("scans", {})
    for scan in scans.get("items", []):
        table_data.append([
            f"Scan - {scan.get('scan_type', '').upper()} ({scan.get('scan_number', '')})",
            f"GHS {scan.get('amount', 0):,.2f}",
            f"GHS {scan.get('paid', 0):,.2f}",
            f"GHS {scan.get('amount', 0) - scan.get('paid', 0):,.2f}"
        ])
    
    # Products
    products = charges.get("products", {})
    for item in products.get("items", []):
        product_name = item.get('product_name', 'Product')
        quantity = item.get('quantity', 1)
        table_data.append([
            f"{product_name} x{quantity}",
            f"GHS {item.get('total', 0):,.2f}",
            f"GHS {item.get('total', 0):,.2f}",
            f"GHS 0.00"
        ])
    
    if len(table_data) > 1:
        charges_table = Table(table_data, colWidths=[80*mm, 35*mm, 35*mm, 35*mm])
        charges_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), KOUNTRY_GREEN),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
            ('TOPPADDING', (0, 1), (-1, -1), 5),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, KOUNTRY_LIGHT_GREEN]),
        ]))
        elements.append(charges_table)
    
    elements.append(Spacer(1, 10*mm))
    
    # Summary totals
    totals = summary.get("summary", {})
    summary_data = [
        ["Grand Total:", f"GHS {totals.get('grand_total', 0):,.2f}"],
        ["Total Paid:", f"GHS {totals.get('total_paid', 0):,.2f}"],
        ["Balance Due:", f"GHS {totals.get('balance_due', 0):,.2f}"],
    ]
    
    summary_table = Table(summary_data, colWidths=[100*mm, 50*mm])
    summary_table.setStyle(TableStyle([
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LINEABOVE', (0, 0), (-1, 0), 1, colors.black),
        ('LINEBELOW', (0, -1), (-1, -1), 2, colors.black),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#c53030') if totals.get('balance_due', 0) > 0 else colors.HexColor('#276749')),
    ]))
    elements.append(summary_table)
    
    elements.append(Spacer(1, 15*mm))
    
    # Footer
    elements.append(Paragraph(f"Printed: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['CenterCheckout']))
    elements.append(Paragraph("Thank you for choosing Kountry Eyecare!", styles['CenterCheckout']))
    
    doc.build(elements)
    buffer.seek(0)
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
