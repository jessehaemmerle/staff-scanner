from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import io
import csv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class Company(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CompanyCreate(BaseModel):
    name: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    company_id: str
    role: str  # 'admin' or 'user'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    company_id: str
    role: str = 'user'

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User

class Employee(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_number: str  # From barcode
    name: str
    company_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EmployeeCreate(BaseModel):
    employee_number: str
    name: str

class Note(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    user_id: str
    note_text: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NoteCreate(BaseModel):
    employee_id: str
    note_text: str

# Auth utilities
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    return User(**user_doc)

# Auth endpoints
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if company exists
    company = await db.companies.find_one({"id": user_data.company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    user_obj = User(
        email=user_data.email,
        company_id=user_data.company_id,
        role=user_data.role
    )
    
    doc = user_obj.model_dump()
    doc['password_hash'] = hashed_password
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.users.insert_one(doc)
    
    # Create token
    access_token = create_access_token(data={"sub": user_obj.id})
    
    return Token(access_token=access_token, user=user_obj)

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user_doc['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    user_doc.pop('password_hash', None)
    user = User(**user_doc)
    
    access_token = create_access_token(data={"sub": user.id})
    
    return Token(access_token=access_token, user=user)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Company endpoints
@api_router.post("/companies", response_model=Company)
async def create_company(company_data: CompanyCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can create companies")
    
    company_obj = Company(name=company_data.name)
    doc = company_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.companies.insert_one(doc)
    return company_obj

@api_router.get("/companies", response_model=List[Company])
async def get_companies(current_user: User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can view companies")
    
    companies = await db.companies.find({}, {"_id": 0}).to_list(1000)
    
    for company in companies:
        if isinstance(company['created_at'], str):
            company['created_at'] = datetime.fromisoformat(company['created_at'])
    
    return companies

@api_router.get("/companies/{company_id}", response_model=Company)
async def get_company(company_id: str):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    if isinstance(company['created_at'], str):
        company['created_at'] = datetime.fromisoformat(company['created_at'])
    
    return Company(**company)

# Employee endpoints
@api_router.post("/employees", response_model=Employee)
async def create_employee(employee_data: EmployeeCreate, current_user: User = Depends(get_current_user)):
    # Check if employee with same number exists in company
    existing = await db.employees.find_one({
        "employee_number": employee_data.employee_number,
        "company_id": current_user.company_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Employee number already exists")
    
    employee_obj = Employee(
        employee_number=employee_data.employee_number,
        name=employee_data.name,
        company_id=current_user.company_id
    )
    
    doc = employee_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.employees.insert_one(doc)
    return employee_obj

@api_router.get("/employees", response_model=List[Employee])
async def get_employees(current_user: User = Depends(get_current_user)):
    employees = await db.employees.find(
        {"company_id": current_user.company_id},
        {"_id": 0}
    ).to_list(1000)
    
    for emp in employees:
        if isinstance(emp['created_at'], str):
            emp['created_at'] = datetime.fromisoformat(emp['created_at'])
    
    return employees

@api_router.get("/employees/{employee_id}", response_model=Employee)
async def get_employee(employee_id: str, current_user: User = Depends(get_current_user)):
    employee = await db.employees.find_one(
        {"id": employee_id, "company_id": current_user.company_id},
        {"_id": 0}
    )
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    if isinstance(employee['created_at'], str):
        employee['created_at'] = datetime.fromisoformat(employee['created_at'])
    
    return Employee(**employee)

@api_router.get("/employees/number/{employee_number}", response_model=Employee)
async def get_employee_by_number(employee_number: str, current_user: User = Depends(get_current_user)):
    employee = await db.employees.find_one(
        {"employee_number": employee_number, "company_id": current_user.company_id},
        {"_id": 0}
    )
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    if isinstance(employee['created_at'], str):
        employee['created_at'] = datetime.fromisoformat(employee['created_at'])
    
    return Employee(**employee)

# Note endpoints
@api_router.post("/notes", response_model=Note)
async def create_note(note_data: NoteCreate, current_user: User = Depends(get_current_user)):
    # Verify employee exists and belongs to user's company
    employee = await db.employees.find_one(
        {"id": note_data.employee_id, "company_id": current_user.company_id}
    )
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    note_obj = Note(
        employee_id=note_data.employee_id,
        user_id=current_user.id,
        note_text=note_data.note_text
    )
    
    doc = note_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.notes.insert_one(doc)
    return note_obj

@api_router.get("/notes", response_model=List[Note])
async def get_notes(current_user: User = Depends(get_current_user)):
    # Get all employees from user's company
    employees = await db.employees.find(
        {"company_id": current_user.company_id},
        {"id": 1}
    ).to_list(1000)
    
    employee_ids = [emp["id"] for emp in employees]
    
    notes = await db.notes.find(
        {"employee_id": {"$in": employee_ids}},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(1000)
    
    for note in notes:
        if isinstance(note['timestamp'], str):
            note['timestamp'] = datetime.fromisoformat(note['timestamp'])
        if isinstance(note['created_at'], str):
            note['created_at'] = datetime.fromisoformat(note['created_at'])
    
    return notes

@api_router.get("/notes/employee/{employee_id}", response_model=List[Note])
async def get_employee_notes(employee_id: str, current_user: User = Depends(get_current_user)):
    # Verify employee belongs to user's company
    employee = await db.employees.find_one(
        {"id": employee_id, "company_id": current_user.company_id}
    )
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    notes = await db.notes.find(
        {"employee_id": employee_id},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(1000)
    
    for note in notes:
        if isinstance(note['timestamp'], str):
            note['timestamp'] = datetime.fromisoformat(note['timestamp'])
        if isinstance(note['created_at'], str):
            note['created_at'] = datetime.fromisoformat(note['created_at'])
    
    return notes

@api_router.get("/notes/export/csv")
async def export_notes_csv(current_user: User = Depends(get_current_user)):
    # Get all employees from user's company
    employees = await db.employees.find(
        {"company_id": current_user.company_id},
        {"_id": 0}
    ).to_list(1000)
    
    employee_map = {emp["id"]: emp for emp in employees}
    employee_ids = list(employee_map.keys())
    
    # Get all notes
    notes = await db.notes.find(
        {"employee_id": {"$in": employee_ids}},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(10000)
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(['Mitarbeiternummer', 'Name', 'Notiz', 'Timestamp', 'Erstellt am'])
    
    # Data
    for note in notes:
        employee = employee_map.get(note['employee_id'], {})
        timestamp = note['timestamp'] if isinstance(note['timestamp'], str) else note['timestamp'].isoformat()
        created_at = note['created_at'] if isinstance(note['created_at'], str) else note['created_at'].isoformat()
        
        writer.writerow([
            employee.get('employee_number', ''),
            employee.get('name', ''),
            note['note_text'],
            timestamp,
            created_at
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=notizen_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
