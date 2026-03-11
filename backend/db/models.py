from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date, Boolean
from sqlalchemy.orm import relationship
from .database import Base

class Occupation(Base):
    __tablename__ = "occupations"
    anzsco_code = Column(String(10), primary_key=True, index=True)
    title = Column(String(255), nullable=False)

class EOISubmission(Base):
    __tablename__ = "eoi_submissions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    month = Column(Date, index=True)
    visa_type = Column(String(50), index=True)
    anzsco_code = Column(String(10), ForeignKey("occupations.anzsco_code"), index=True)
    status = Column(String(50))  # Submitted, Invited, etc.
    points = Column(Integer)
    nominated_state = Column(String(10))
    count = Column(Integer)

    occupation = relationship("Occupation")

class Quota(Base):
    __tablename__ = "quotas"
    id = Column(Integer, primary_key=True, autoincrement=True)
    program_year = Column(String(20), index=True)  # e.g., "2024-25"
    state = Column(String(10), index=True) # ACT, NSW, etc. National for national
    visa_type = Column(String(100))
    allocation = Column(Integer)

class OSLShortage(Base):
    __tablename__ = "osl_shortages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    year = Column(Integer, index=True)
    anzsco_code = Column(String(10), ForeignKey("occupations.anzsco_code"), index=True)
    shortage_status = Column(String(50))  # e.g., S (Shortage), M (Met), etc.
    shortage_type = Column(String(50))    # e.g. National, Regional

    occupation = relationship("Occupation")

class NeroEmployment(Base):
    __tablename__ = "nero_employment"
    id = Column(Integer, primary_key=True, autoincrement=True)
    state = Column(String(10), index=True)
    sa4_code = Column(String(10), index=True)
    sa4_name = Column(String(255))
    anzsco_code = Column(String(10), ForeignKey("occupations.anzsco_code"), index=True)
    date = Column(Date, index=True)
    count = Column(Integer)

    occupation = relationship("Occupation")
