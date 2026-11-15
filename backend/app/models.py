from typing import Literal, Optional

from pydantic import BaseModel, Field


Species = Literal["Dog", "Cat", "Hamster", "Rabbit", "Bird", "Other"]
Age = Literal["Baby", "Young", "Adult"]
Size = Literal["Small", "Medium", "Large"]
Sex = Literal["Female", "Male", "Pair"]
CauseUrgency = Literal["Urgent", "This month", "Ongoing"]
ActivityType = Literal["adoption", "foster", "volunteer", "donation"]


class Pet(BaseModel):
    id: str
    name: str
    src: str
    shelterId: str
    species: Species
    age: Age
    size: Size
    sex: Sex
    breed: str
    notes: list[str] = Field(max_length=4)
    sourceUrl: str


class PetDetail(BaseModel):
    story: str
    health: str
    idealHome: str


class PetPolicies(BaseModel):
    adopt: list[str]
    foster: list[str]


class PetDetailResponse(BaseModel):
    pet: Pet
    details: PetDetail
    policies: PetPolicies


class Shelter(BaseModel):
    id: str
    name: str
    city: str
    address: str
    mission: str
    about: str
    hours: str
    phone: str
    email: str
    website: str
    avatar: str
    animals: list[Literal["Dogs", "Cats", "Small animals", "Birds"]]
    roles: list[str]
    needs: list[str]
    notes: list[str]
    source: Literal["tinyfish", "rescuegroups", "registered"]


class Request(BaseModel):
    id: str
    title: str
    amount: int
    raised: int
    note: str
    pet: Optional[str] = None
    src: Optional[str] = None
    animal: Optional[str] = None
    type: Optional[str] = None
    urgency: Optional[CauseUrgency] = None
    breakdown: list[str] = Field(default_factory=list)


class Photo(BaseModel):
    id: str
    src: str
    name: str


class ShelterDetailResponse(Shelter):
    requests: list[Request]
    photos: list[Photo]


class Cause(BaseModel):
    id: str
    shelterId: str
    pet: str
    src: str
    shelter: str
    city: str
    animal: str
    type: str
    urgency: CauseUrgency
    goal: int
    raised: int
    story: str
    breakdown: list[str]


class AdoptionActivity(BaseModel):
    pet: str
    kind: str
    date: str


class FosterActivity(BaseModel):
    pet: str
    kind: str
    from_: str = Field(alias="from")
    to: str


class VolunteerActivity(BaseModel):
    what: str
    hours: int
    date: str


class DonationActivity(BaseModel):
    amount: int
    date: str
    note: str


class User(BaseModel):
    token: str
    name: str
    email: str
    phone: str
    age: int
    address: str
    idUploaded: bool
    joined: str
    adoptions: list[AdoptionActivity]
    fosters: list[FosterActivity]
    volunteer: list[VolunteerActivity]
    donations: list[DonationActivity]
    xp: int
    badges: list[str]


class ShelterAccount(BaseModel):
    token: str
    id: str
    name: str
    email: str
    address: str
    animals: list[str]
    website: str
    licenseUploaded: bool
    mission: str
    joined: str
    requests: list[Request]
    photos: list[Photo]


class Area(BaseModel):
    zip: str
    city: str
    state: str
    lat: float
    lng: float
    status: Literal["ready", "loading", "empty", "limit"]
    pets: int
    shelters: int


class RescueContact(BaseModel):
    who: str
    phone: str
    ext: Optional[str] = None


class RescueSource(BaseModel):
    name: str
    url: str


class RescueContacts(BaseModel):
    region: str
    contacts: list[RescueContact]
    sources: list[RescueSource]


class ChatFilters(BaseModel):
    species: list[Species]
    age: list[Age]
    size: list[Size]
    sex: list[Sex]
    city: str


class ChatPet(Pet):
    shelterName: str


class ChatResponse(BaseModel):
    reply: str
    filters: ChatFilters
    pets: list[ChatPet]


class PetFilters(BaseModel):
    species: list[Species]
    age: list[Age]
    size: list[Size]
    sex: list[Sex]


class SignupBody(BaseModel):
    name: str
    email: str
    phone: str
    password: str
    confirm: Optional[str] = None
    age: int
    address: str
    idFileName: Optional[str] = None


class LoginBody(BaseModel):
    email: str
    password: str


class ShelterSignupBody(BaseModel):
    name: str
    email: str
    password: str
    confirm: Optional[str] = None
    address: str
    website: str
    animals: list[str]
    licenseFileName: Optional[str] = None


class ActivityBody(BaseModel):
    type: ActivityType
    pet: Optional[str] = None
    kind: Optional[str] = None
    date: Optional[str] = None
    from_: Optional[str] = Field(default=None, alias="from")
    to: Optional[str] = None
    what: Optional[str] = None
    hours: Optional[int] = None
    amount: Optional[int] = None
    note: Optional[str] = None


class ChatBody(BaseModel):
    message: str
