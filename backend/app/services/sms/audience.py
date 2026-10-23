"""Turn a campaign audience (filters, saved group, pasted numbers, chosen patients) into recipients."""
import re
from datetime import date, datetime

from sqlalchemy import select, func

from app.services.sms.text import normalize_phone


def _age(dob: date | None, today: date) -> int | None:
    if not dob:
        return None
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _parse_date(value) -> date | None:
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date() if value else None
    except ValueError:
        return None


async def resolve_audience(db, audience: dict, *, respect_opt_out: bool = True) -> dict:
    """Returns {"recipients": [{phone, name, patient}], "skipped_opt_out": n, "skipped_no_phone": n}."""
    from app.models.patient import Patient, Visit
    from app.models.sms import ContactGroupMember

    kind = (audience or {}).get("type", "filters")
    out, seen = [], set()
    skipped_opt_out = skipped_no_phone = 0
    # Numbers of opted-out patients, so pasted numbers and phone-only group members are skipped too
    opted_out = set()
    if respect_opt_out:
        for raw in (await db.execute(select(Patient.phone).where(Patient.promo_opt_out.is_(True)))).scalars():
            if normalize_phone(raw):
                opted_out.add(normalize_phone(raw))

    def push(phone, name, patient=None):
        nonlocal skipped_opt_out, skipped_no_phone
        number = normalize_phone(phone)
        if respect_opt_out and ((patient is not None and patient.promo_opt_out) or (number and number in opted_out)):
            skipped_opt_out += 1
            return
        if not number:
            skipped_no_phone += 1
            return
        if number in seen:
            return
        seen.add(number)
        out.append({"phone": number, "name": name, "patient": patient})

    if kind == "numbers":
        for chunk in re.split(r"[\n,;]+", str(audience.get("numbers") or "")):
            chunk = chunk.strip()
            if not chunk:
                continue
            # "+233 24 512 3002" is one number; "0244111222 0244333444" is two
            if normalize_phone(re.sub(r"[\s-]", "", chunk)):
                push(chunk, None)
            else:
                for raw in chunk.split():
                    push(raw, None)
    elif kind == "group":
        members = (await db.execute(select(ContactGroupMember).where(ContactGroupMember.group_id == int(audience.get("group_id") or 0)))).scalars().all()
        patients = {}
        ids = [m.patient_id for m in members if m.patient_id]
        if ids:
            patients = {p.id: p for p in (await db.execute(select(Patient).where(Patient.id.in_(ids)))).scalars().all()}
        for m in members:
            push(m.phone, m.name, patients.get(m.patient_id))
    elif kind == "patients":
        ids = [int(i) for i in (audience.get("patient_ids") or []) if str(i).isdigit()][:5000]
        for p in (await db.execute(select(Patient).where(Patient.id.in_(ids)))).scalars().all():
            push(p.phone, f"{p.first_name} {p.last_name}", p)
    else:  # filters
        today = date.today()
        q = select(Patient)
        if audience.get("branch_id"):
            q = q.where(Patient.branch_id == int(audience["branch_id"]))
        if audience.get("sex"):
            q = q.where(func.lower(Patient.sex) == str(audience["sex"]).lower())
        patients = (await db.execute(q)).scalars().all()
        min_age, max_age = audience.get("min_age"), audience.get("max_age")
        after, before = _parse_date(audience.get("last_visit_after")), _parse_date(audience.get("last_visit_before"))
        insurance = audience.get("insurance")  # "any" | "none" | provider name
        need_visits = after or before or insurance
        last_visit, insured = {}, {}
        if need_visits:
            for v in (await db.execute(select(Visit.patient_id, Visit.visit_date, Visit.payment_type, Visit.insurance_provider))).all():
                d = v.visit_date.date() if v.visit_date else None
                if d and (v.patient_id not in last_visit or d > last_visit[v.patient_id]):
                    last_visit[v.patient_id] = d
                if v.payment_type == "insurance":
                    insured.setdefault(v.patient_id, set()).add(v.insurance_provider or "")
        balances = None
        if audience.get("has_balance"):
            from app.services.balances import all_patient_balances
            balances = await all_patient_balances(db)
        for p in patients:
            age = _age(p.date_of_birth, today)
            if min_age not in (None, "") and (age is None or age < int(min_age)):
                continue
            if max_age not in (None, "") and (age is None or age > int(max_age)):
                continue
            lv = last_visit.get(p.id)
            if after and (not lv or lv < after):
                continue
            if before and (not lv or lv > before):
                continue
            if insurance == "any" and p.id not in insured:
                continue
            if insurance == "none" and p.id in insured:
                continue
            if insurance not in (None, "", "any", "none") and insurance not in insured.get(p.id, set()):
                continue
            if balances is not None and p.id not in balances:
                continue
            push(p.phone, f"{p.first_name} {p.last_name}", p)

    return {"recipients": out, "skipped_opt_out": skipped_opt_out, "skipped_no_phone": skipped_no_phone}
