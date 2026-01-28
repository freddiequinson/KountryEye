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
