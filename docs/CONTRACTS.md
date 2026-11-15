# API contracts

## Pet

`GET /api/pets` returns a list of these objects. The keys match `ADOPTABLE` in `pets.js`.

```json
{"id":"<string>","name":"<string>","src":"<photo URL>","shelterId":"<string>","species":"<Dog|Cat|Hamster|Rabbit|Bird|Other>","age":"<Baby|Young|Adult>","size":"<Small|Medium|Large>","sex":"<Female|Male|Pair>","breed":"<string>","notes":["<short string, up to 4>"],"sourceUrl":"<the animal's own page, or empty>"}
```

## PetDetail

Keys match one `PET_DETAILS` entry.

```json
{"story":"<string>","health":"<string>","idealHome":"<string>"}
```

`GET /api/pets/{id}` returns:

```json
{"pet":Pet,"details":PetDetail,"policies":{"adopt":["<string>"],"foster":["<string>"]}}
```

## Shelter

Keys match `SHELTERS` in `pets.js`, plus `source`.

```json
{"id":"<string>","name":"<string>","city":"<string>","address":"<string>","mission":"<string>","about":"<string>","hours":"<string>","phone":"<string>","email":"<string>","website":"<URL>","avatar":"<image URL or empty>","animals":["<Dogs|Cats|Small animals|Birds>"],"roles":["<string>"],"needs":["<string>"],"notes":["<string>"],"source":"<tinyfish|rescuegroups|registered>"}
```

`GET /api/shelters/{id}` returns a Shelter plus:

```json
{"requests":[Request],"photos":[Photo]}
```

## Request

Created by the shelter dashboard form. The last five keys are optional and null when missing.

```json
{"id":"<string>","title":"<string>","amount":0,"raised":0,"note":"<string>","pet":null,"src":null,"animal":null,"type":null,"urgency":null,"breakdown":[]}
```

## Photo

```json
{"id":"<string>","src":"<URL, uploads look like /api/uploads/<file>>","name":"<string>"}
```

## Cause

Keys match `CAUSES` in `pets.js`. `GET /api/causes` returns a list built from Requests.

```json
{"id":"<string>","shelterId":"<string>","pet":"<string>","src":"<URL or empty>","shelter":"<shelter name>","city":"<string>","animal":"<string>","type":"<string>","urgency":"<Urgent|This month|Ongoing>","goal":0,"raised":0,"story":"<string>","breakdown":["<string>"]}
```

## User

Returned by signup, login, and `GET /api/me`. Keys match `starterProfile` in `auth.js`, plus `token`.

```json
{"token":"<opaque string>","name":"<string>","email":"<string>","phone":"<string>","age":0,"address":"<string>","idUploaded":false,"joined":"<YYYY-MM-DD>","adoptions":[{"pet":"<string>","kind":"<string>","date":"<YYYY-MM-DD>"}],"fosters":[{"pet":"<string>","kind":"<string>","from":"<date>","to":"<date>"}],"volunteer":[{"what":"<string>","hours":0,"date":"<YYYY-MM>"}],"donations":[{"amount":0,"date":"<YYYY-MM-DD>","note":"<string>"}],"xp":50,"badges":["New member"]}
```

## ShelterAccount

Keys match `starterShelter` in `shelterAuth.js`, plus `id` and `token`.

```json
{"token":"<opaque string>","id":"<string>","name":"<string>","email":"<string>","address":"<string>","animals":["<string>"],"website":"<URL>","licenseUploaded":false,"mission":"<string>","joined":"<YYYY-MM-DD>","requests":[Request],"photos":[Photo]}
```

## Area

`GET /api/area?lat=<number>&lng=<number>` or `GET /api/area?zip=<5 digits>` returns the visitor's area and starts a live search when the area is new.

```json
{"zip":"<string>","city":"<string>","state":"<string>","lat":0,"lng":0,"status":"<ready|loading|empty|limit>","pets":0,"shelters":0}
```

## Rescue contacts

`GET /api/rescue-contacts?lat=<number>&lng=<number>`

```json
{"region":"<string>","contacts":[{"who":"<string>","phone":"<string>","ext":"<optional string>"}],"sources":[{"name":"<string>","url":"<URL>"}]}
```

## Chat

`POST /api/chat` accepts `{"message":"<string>"}`. Each pet in the response is a Pet plus `shelterName`.

```json
{"reply":"<string>","filters":{"species":[],"age":[],"size":[],"sex":[],"city":"<string>"},"pets":[Pet]}
```

## Pet filters

`GET /api/filters/pets` returns only values present in the fetched pet data. A source's `Senior` age is normalized to `Adult`, and `X-Large` size is normalized to `Large`.

```json
{"species":["<Dog|Cat|Hamster|Rabbit|Bird|Other>"],"age":["<Baby|Young|Adult>"],"size":["<Small|Medium|Large>"],"sex":["<Female|Male|Pair>"]}
```

## Allowed values

- Species: `Dog`, `Cat`, `Hamster`, `Rabbit`, `Bird`, `Other`. The frontend filter currently lists `Dog`, `Cat`, and `Hamster`.
- Age: `Baby`, `Young`, `Adult`; source value `Senior` becomes `Adult`.
- Size: `Small`, `Medium`, `Large`; source value `X-Large` becomes `Large`.
- Sex: `Female`, `Male`, `Pair`.
- Shelter animals: `Dogs`, `Cats`, `Small animals`, `Birds`.
- Cause urgency: `Urgent`, `This month`, `Ongoing`.
- Activity type: `adoption`, `foster`, `volunteer`, `donation`.
- Passwords are never returned; only hashes are stored.

## Errors

Every error response (status 400, 401, 403, 404, or 500) is:

```json
{"detail":"<message a person can read>"}
```
