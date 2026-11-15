// Real-life pet photos shown in the marquee.
export const PETS = [
  { src: "/pets/kitten-grey-white.jpg", alt: "Grey and white kitten with a star collar" },
  { src: "/pets/golden-puppy.jpg", alt: "Golden retriever puppy lying in grass" },
  { src: "/pets/bernese.jpg", alt: "Bernese mountain dog standing in a meadow" },
  { src: "/pets/scottish-fold.jpg", alt: "Scottish fold kitten with a ball of yarn" },
  { src: "/pets/tabby-kitten.jpg", alt: "Tabby kitten on a blanket" },
  { src: "/pets/hamster.jpg", alt: "Golden hamster on a shelf" },
  { src: "/pets/two-puppies.jpg", alt: "Two puppies looking over a doorstep" },
  { src: "/pets/husky.jpg", alt: "Siberian husky trotting through snow" },
];

export const FUN_FACTS = [
  "A group of kittens is called a kindle.",
  "A dog's nose print is as unique as a human fingerprint.",
  "Hamsters can stuff their cheek pouches with food up to their shoulders.",
  "Cats spend roughly 70% of their lives asleep.",
  "Dogs can learn more than 100 words and gestures.",
  "Parrots are one of the few animals that can dance to a beat.",
  "Rabbits do a happy jump-and-twist called a binky.",
  "Adult cats meow almost only at humans, not at other cats.",
];

// Who to call to rescue a stray, by location.
// Sources: Maricopa County Animal Care & Control (maricopa.gov/162), Town of Oro Valley (PACC),
// Humane Society of Southern Arizona. Numbers checked Nov 2026 — re-verify before relying on them.
// Each region has a centre + radius (km); the page picks the smallest region the visitor is inside.
export const REGIONS = [
  { name: "Mesa", lat: 33.415, lng: -111.831, km: 10 },
  { name: "Peoria", lat: 33.581, lng: -112.237, km: 9 },
  { name: "Avondale", lat: 33.436, lng: -112.350, km: 7 },
  { name: "Surprise / El Mirage", lat: 33.630, lng: -112.367, km: 12 },
  { name: "Sun City", lat: 33.598, lng: -112.272, km: 5 },
  { name: "Phoenix / Tempe / Scottsdale / Chandler / Gilbert / Glendale", lat: 33.45, lng: -112.07, km: 45 },
  { name: "Tucson / Pima County", lat: 32.222, lng: -110.975, km: 45 },
];

export const RESCUE_CONTACTS = {
  "Phoenix / Tempe / Scottsdale / Chandler / Gilbert / Glendale": [
    { who: "Maricopa County Animal Care & Control — healthy strays, lost & found", phone: "602-506-7387" },
    { who: "Arizona Humane Society — sick, injured or abused strays", phone: "602-997-7585", ext: "ext. 2073" },
  ],
  "Mesa": [
    { who: "Mesa Animal Control — healthy, sick or injured strays", phone: "480-644-2268" },
    { who: "Maricopa County Animal Care & Control — lost & found", phone: "602-506-7387" },
  ],
  "Peoria": [
    { who: "Peoria Animal Control — healthy, sick or injured strays", phone: "623-773-8311" },
  ],
  "Avondale": [
    { who: "Avondale — healthy strays", phone: "623-333-7012" },
    { who: "Avondale — sick or injured strays", phone: "623-333-7001" },
  ],
  "Surprise / El Mirage": [
    { who: "Surprise Animal Control — healthy, sick or injured strays", phone: "623-222-4000" },
  ],
  "Sun City": [
    { who: "Sick or injured strays", phone: "602-256-1011" },
    { who: "Maricopa County Animal Care & Control — healthy strays", phone: "602-506-7387" },
  ],
  "Tucson / Pima County": [
    { who: "Pima Animal Care Center — strays, injured animals, cruelty", phone: "520-724-5900", ext: "ext. 4" },
    { who: "Humane Society of Southern Arizona", phone: "520-327-6088" },
  ],
  "Somewhere else": [
    { who: "Your city's animal control (dial 311 in most US cities)", phone: "311" },
    { who: "Animal in immediate danger or attacking", phone: "911" },
  ],
};

export const TEMPE_WELFARE_RESOURCE = {
  city: "Tempe",
  searchTerms: ["tempe", "85281"],
  name: "City of Tempe Office of Animal Welfare",
  address: "3400 S. Mill Ave., Suite 25\nTempe, AZ 85282",
  hotline: { label: "Animal Welfare Hotline", phone: "480-858-PETS (7387)" },
  email: "animalwelfare@tempe.gov",
  website: "https://www.tempe.gov/government/community-health-and-human-services/animal-welfare",
  timeSensitiveContact: {
    name: "Tempe 311",
    description: "Time-sensitive animal-related needs during business hours",
    phone: "480-350-4311",
  },
  serviceLimitation:
    "No on-site animal care, veterinary services, or animal surrenders are provided at the Office of Animal Welfare.",
  verified: true,
};

export const CONTACT_SOURCES = [
  { name: "Maricopa County — Lost & Found Pets", url: "https://www.maricopa.gov/162/lost-found-pet" },
  { name: "Town of Oro Valley — Animals & Pets (PACC)", url: "https://www.orovalleyaz.gov/Community/Animals-and-Pets" },
  { name: "Humane Society of Southern Arizona", url: "https://hssaz.org/our-services/lost-and-found/" },
];

// ---- Demo adoption listings (made-up profiles on the sample photos) ----
export const ADOPTABLE = [
  { id: 1, name: "Pebble",  src: "/pets/kitten-grey-white.jpg", shelterId: 1, species: "Cat",     age: "Baby",   size: "Small",  sex: "Female", breed: "Domestic shorthair",
    notes: ["Loves her star collar", "Chirps at birds", "Litter trained", "Needs a quiet home"] },
  { id: 2, name: "Biscuit", src: "/pets/golden-puppy.jpg", shelterId: 5,     species: "Dog",     age: "Baby",   size: "Large",  sex: "Male",   breed: "Golden retriever",
    notes: ["Fluffiest pup in the shelter", "Chews everything (shoes beware)", "Great with kids", "Will be ~65 lb grown"] },
  { id: 3, name: "Bruno",   src: "/pets/bernese.jpg", shelterId: 4,          species: "Dog",     age: "Adult",  size: "Large",  sex: "Male",   breed: "Bernese mountain dog",
    notes: ["Gentle giant, 95 lb", "Walks nicely on a leash", "Loves cold weather", "Needs a yard"] },
  { id: 4, name: "Mochi",   src: "/pets/scottish-fold.jpg", shelterId: 2,    species: "Cat",     age: "Young",  size: "Small",  sex: "Female", breed: "Scottish fold",
    notes: ["Obsessed with yarn", "Shy for the first week", "Indoor only", "Good with other cats"] },
  { id: 5, name: "Tigger",  src: "/pets/tabby-kitten.jpg", shelterId: 1,     species: "Cat",     age: "Baby",   size: "Small",  sex: "Male",   breed: "Tabby",
    notes: ["Curious about everything", "Purrs on contact", "Vaccinated", "Bonded with Pebble"] },
  { id: 6, name: "Peanut",  src: "/pets/hamster.jpg", shelterId: 3,          species: "Hamster", age: "Adult",  size: "Small",  sex: "Male",   breed: "Syrian hamster",
    notes: ["Night owl", "Loves sunflower seeds", "Comes with cage & wheel", "Handles well"] },
  { id: 7, name: "Sunny & Bean", src: "/pets/two-puppies.jpg", shelterId: 8, species: "Dog",     age: "Baby",   size: "Medium", sex: "Pair",   breed: "Mixed",
    notes: ["Bonded pair, adopt together", "Door-watchers", "House training in progress", "Sweet and sleepy"] },
  { id: 8, name: "Luna",    src: "/pets/husky.jpg", shelterId: 8,            species: "Dog",     age: "Adult",  size: "Large",  sex: "Female", breed: "Siberian husky",
    notes: ["Needs lots of exercise", "Talks (howls) a lot", "Escape artist — tall fence", "Loves snow & runs"] },
];
export const FILTERS = {
  species: ["Dog", "Cat", "Hamster"],
  age: ["Baby", "Young", "Adult"],
  size: ["Small", "Medium", "Large"],
  sex: ["Female", "Male", "Pair"],
};

// ---- Extended details shown when "Ask about <pet>" is clicked (demo content) ----
export const PET_DETAILS = {
  1: { story: "Pebble was found under a porch in Tempe with her brother Tigger. She was tiny and scared but has blossomed into a confident, chatty kitten who follows people from room to room.",
       health: "Spayed, FVRCP + rabies vaccinated, microchipped, FIV/FeLV negative.", fee: 95, idealHome: "Quiet apartment or house; fine as an only cat or with Tigger." },
  2: { story: "Biscuit came from a litter surrendered when the owner's dog had an unplanned pregnancy. He is bouncy, food-motivated and already knows 'sit'.",
       health: "Neutered, first two puppy vaccine rounds done, dewormed, microchipped.", fee: 250, idealHome: "Active family with time for training and a fenced yard; kids 6+." },
  3: { story: "Bruno's owner moved into assisted living and could not take him. He is calm, house-trained and happiest lying next to his people.",
       health: "Neutered, fully vaccinated, microchipped. Mild hip stiffness — joint supplement recommended.", fee: 150, idealHome: "House with a yard and air-conditioning; no stairs if possible." },
  4: { story: "Mochi was left in a carrier outside the shelter overnight. She hid for a week, then decided laps are the best place in the world.",
       health: "Spayed, vaccinated, microchipped, dental check done.", fee: 120, idealHome: "Calm indoor home; good with gentle cats, unsure about dogs." },
  5: { story: "Tigger is Pebble's brother and the braver of the two. He greets every visitor at the kennel door and loves feather wands.",
       health: "Neutered, FVRCP + rabies vaccinated, microchipped, FIV/FeLV negative.", fee: 95, idealHome: "Any loving home; happiest adopted together with Pebble." },
  6: { story: "Peanut was surrendered when his family moved. He is tame, loves his wheel and will take seeds from your hand.",
       health: "Vet checked, healthy teeth and coat.", fee: 15, idealHome: "Quiet room away from cats; 10+ year old child with adult supervision." },
  7: { story: "Sunny and Bean were found together on a doorstep in Mesa and have never been apart. They sleep in a pile and comfort each other.",
       health: "Both spayed/neutered, puppy vaccines in progress, dewormed, microchipped.", fee: 300, idealHome: "Home that can take both; patient owners for house-training." },
  8: { story: "Luna was picked up as a stray running along the Loop 101. She is friendly, smart, vocal and built to run.",
       health: "Spayed, fully vaccinated, microchipped, heartworm negative.", fee: 175, idealHome: "Runner or hiker with a 6-ft fence; no cats or small animals." },
};

export const ADOPTION_POLICIES = [
  "Adopters must be 18 or older and show a government-issued photo ID.",
  "Meet the pet in person at the shelter before an adoption is finalized; bonded pairs are adopted together.",
  "Renters need written landlord permission; a short home visit may be requested for large dogs.",
  "The adoption fee covers spay/neuter, vaccinations and a microchip. Fees are non-refundable.",
  "Every adopter gets a free vet check within 14 days and 30 days of pet insurance.",
  "If it doesn't work out, bring the pet back to us at any time — never rehome or surrender elsewhere.",
];

export const FOSTER_POLICIES = [
  "Fosters must be 18 or older and complete a 1-hour orientation (in person or online).",
  "The shelter supplies food, crate, litter and all vet care; you supply the love and the couch.",
  "Typical foster stays are 2–8 weeks; you can set a maximum length you're comfortable with.",
  "Foster pets must stay indoors and separate from your own pets for the first 10 days.",
  "Fosters get first choice to adopt their foster pet (\"foster fail\") with the fee waived.",
  "Call the foster line any time — a staff member is on duty 7 days a week.",
];

// ---- Demo shelter directory for Volunteer / Donate (fictional shelters) ----
export const SHELTERS = [
  { id: 1, name: "Desert Paws Rescue", city: "Tempe", address: "412 E Apache Blvd",
    mission: "Every dog and cat in Tempe deserves a soft bed and a second chance. We keep animals out of overcrowded county kennels by fostering, treating and rehoming them — no time limits, ever.",
    about: "Founded by two ASU alumni in 2018, Desert Paws runs a small no-kill shelter and a foster network across Tempe. Most of their dogs come from Maricopa County intake overflow.", hours: "Tue–Sun 10am–6pm", phone: "(480) 555-0141", email: "hello@desertpaws.example", website: "https://example.com/desert-paws", animals: ["Dogs", "Cats"], avatar: "/footer/shiba-smile.png",
    roles: ["Dog walking", "Adoption events"], needs: ["Money", "Dog food", "Blankets"],
    notes: ["Open 10am–6pm, closed Mondays", "Volunteer shifts are 2 hours", "Walk-in donations welcome", "Student-friendly schedules"] },
  { id: 2, name: "Sunrise Cat Haven", city: "Phoenix", address: "1900 N 7th St",
    mission: "We believe cats thrive when they can roam, climb and choose their people. Sunrise gives Phoenix's homeless cats a cage-free home until their forever family walks in.",
    about: "A cage-free cat sanctuary in central Phoenix with three free-roam rooms and a neonatal kitten nursery that runs every spring.", hours: "Daily 11am–5pm", phone: "(602) 555-0177", email: "meow@sunrisecats.example", website: "https://example.com/sunrise-cat-haven", animals: ["Cats"], avatar: "/footer/orange-cat.png",
    roles: ["Cat socializing", "Cleaning"], needs: ["Litter", "Money", "Toys"],
    notes: ["Cat-only, cage-free rooms", "Bottle-feeding kittens in spring", "Amazon wish list available", "Quiet volunteers wanted"] },
  { id: 3, name: "Valley Small Animal Rescue", city: "Mesa", address: "77 S Country Club Dr",
    mission: "Small animals are real pets with real needs. We rescue, rehabilitate and rehome the hamsters, rabbits and birds that bigger shelters can't take.",
    about: "Arizona's only rescue dedicated to hamsters, rabbits, guinea pigs and small birds. Volunteer-run out of a converted storefront in downtown Mesa.", hours: "Sat 9am–1pm, by appointment otherwise", phone: "(480) 555-0106", email: "smalls@valleysmallanimal.example", website: "https://example.com/valley-small-animal", animals: ["Small animals", "Birds"], avatar: "/footer/hamster-eat.png",
    roles: ["Cage cleaning", "Transport"], needs: ["Bedding", "Seeds", "Money"],
    notes: ["Hamsters, rabbits, guinea pigs, parakeets", "Saturday mornings only", "Needs drivers with a car", "Small but mighty"] },
  { id: 4, name: "Red Rock Animal Shelter", city: "Scottsdale", address: "8800 E Via Linda",
    mission: "Red Rock is Scottsdale's safety net for lost and surrendered animals: reunite the lost, heal the hurt, and find a home for every adoptable pet.",
    about: "Scottsdale's municipal shelter: 120 kennels, a vet clinic on site, and a volunteer program with over 400 active members.", hours: "Mon–Sat 9am–7pm, Sun 11am–5pm", phone: "(480) 555-0192", email: "volunteer@redrockshelter.example", website: "https://example.com/red-rock-shelter", animals: ["Dogs", "Cats", "Small animals"], avatar: "/footer/white-dog.png",
    roles: ["Dog walking", "Front desk", "Photography"], needs: ["Money", "Cat food", "Towels"],
    notes: ["Large municipal shelter", "Orientation every Tuesday", "Photographers help pets get adopted", "Air-conditioned kennels"] },
  { id: 5, name: "Chandler Second Chance", city: "Chandler", address: "250 W Chandler Blvd",
    mission: "Senior and large-breed dogs wait the longest. We train them, love them and prove that the best dog in the room is often the oldest or biggest one.",
    about: "A second-chance rescue for senior and large-breed dogs that other shelters struggle to place. Every dog gets basic obedience training before adoption.", hours: "Wed–Sun 10am–5pm", phone: "(480) 555-0133", email: "dogs@chandlersecondchance.example", website: "https://example.com/chandler-second-chance", animals: ["Dogs"], avatar: "/footer/dog-flat.png",
    roles: ["Dog training", "Adoption events"], needs: ["Leashes", "Money", "Dog food"],
    notes: ["Focus on seniors and big dogs", "Training-minded volunteers", "Monthly adoption fair at the mall", "Foster-to-adopt program"] },
  { id: 6, name: "Gilbert Kitten Nursery", city: "Gilbert", address: "15 N Gilbert Rd",
    mission: "Orphaned kittens can't wait — they need a bottle every three hours. Our nursery gives East Valley neonates the round-the-clock care they need to grow up.",
    about: "A kitten-only nursery that takes in orphaned neonates from across the East Valley. Bottle feeders work in 3-hour shifts around the clock during kitten season.", hours: "Volunteers 24/7 in season; office Mon–Fri 9am–4pm", phone: "(480) 555-0158", email: "nursery@gilbertkittens.example", website: "https://example.com/gilbert-kitten-nursery", animals: ["Cats"], avatar: "/footer/wand-cat.png",
    roles: ["Bottle feeding", "Laundry"], needs: ["Kitten formula", "Money", "Heating pads"],
    notes: ["Neonatal kittens only", "Overnight feeders needed", "Short training provided", "Tiny patients, big impact"] },
  { id: 7, name: "Old Pueblo Pet Rescue", city: "Tucson", address: "3450 N Kelvin Blvd",
    mission: "From desert dogs to rehomed parrots, Old Pueblo gives every animal in southern Arizona a place to land and a path to a family.",
    about: "Southern Arizona's largest private rescue, with a dog campus, a cat house and the state's only parrot rehoming room.", hours: "Daily 10am–6pm", phone: "(520) 555-0119", email: "info@oldpueblopets.example", website: "https://example.com/old-pueblo-pet-rescue", animals: ["Dogs", "Cats", "Birds"], avatar: "/footer/chick-bow.png",
    roles: ["Dog walking", "Bird care", "Cleaning"], needs: ["Money", "Bird seed", "Crates"],
    notes: ["Largest rescue in southern Arizona", "Parrot room needs patient helpers", "Open 7 days", "Volunteer app available"] },
  { id: 8, name: "West Valley Hope Shelter", city: "Glendale", address: "6100 W Olive Ave",
    mission: "We serve the whole west valley, in English and Spanish, with adoption events where families already are — because a shelter should meet people halfway.",
    about: "Serving Glendale, Peoria and the west valley since 2009. Known for weekend adoption events at local pet stores and a bilingual volunteer team.", hours: "Tue–Sun 10am–6pm", phone: "(623) 555-0164", email: "hola@westvalleyhope.example", website: "https://example.com/west-valley-hope", animals: ["Dogs", "Cats"], avatar: "/footer/puppy-stack.png",
    roles: ["Adoption events", "Front desk", "Transport"], needs: ["Blankets", "Money", "Cleaning supplies"],
    notes: ["Serves the whole west valley", "Weekend events at pet stores", "Bilingual volunteers appreciated", "Supply drop-off at the back door"] },
];
export const SHELTER_FILTERS = {
  city: ["Phoenix", "Tempe", "Mesa", "Scottsdale", "Chandler", "Gilbert", "Glendale", "Tucson"],
  animals: ["Dogs", "Cats", "Small animals", "Birds"],
};
export const VOLUNTEER_ROLES = ["Dog walking", "Cat socializing", "Adoption events", "Cleaning", "Transport", "Front desk", "Bottle feeding", "Dog training", "Photography", "Bird care", "Laundry", "Cage cleaning"];
export const DONATION_NEEDS = ["Money", "Dog food", "Cat food", "Litter", "Blankets", "Towels", "Toys", "Kitten formula", "Bedding", "Seeds", "Bird seed", "Leashes", "Crates", "Heating pads", "Cleaning supplies"];

// ---- Donation causes (demo) ----
export const CAUSES = [
  { id: 1, pet: "Berry", src: "/pets/golden-puppy.jpg", shelter: "Desert Paws Rescue", city: "Tempe", animal: "Dogs", type: "Medication", urgency: "Urgent",
    goal: 480, raised: 310, story: "Berry has a nasty skin infection and needs a 6-week course of antibiotics and medicated baths. She's itchy but still wags at everyone.",
    breakdown: ["Antibiotics (6 weeks) — $180", "Medicated shampoo — $60", "Two vet rechecks — $240"] },
  { id: 2, pet: "Bruno", src: "/pets/bernese.jpg", shelter: "Red Rock Animal Shelter", city: "Scottsdale", animal: "Dogs", type: "Surgery", urgency: "Urgent",
    goal: 2400, raised: 1150, story: "Bruno's hips make it painful to stand. A specialist says one surgery will give this gentle giant years of comfortable walks.",
    breakdown: ["Hip surgery — $1,900", "X-rays & bloodwork — $300", "Pain meds & physio — $200"] },
  { id: 3, pet: "Pebble & Tigger", src: "/pets/kitten-grey-white.jpg", shelter: "Gilbert Kitten Nursery", city: "Gilbert", animal: "Cats", type: "Food & formula", urgency: "This month",
    goal: 150, raised: 95, story: "These bottle babies are growing fast and going through formula like crazy. Keep the nursery stocked until they're on solid food.",
    breakdown: ["Kitten formula (4 weeks) — $90", "Weaning food — $40", "Bottles & nipples — $20"] },
  { id: 4, pet: "Mochi", src: "/pets/scottish-fold.jpg", shelter: "Sunrise Cat Haven", city: "Phoenix", animal: "Cats", type: "Dental", urgency: "This month",
    goal: 650, raised: 120, story: "Mochi has two broken teeth that hurt when she eats. A dental cleaning and two extractions will have her purring over her bowl again.",
    breakdown: ["Dental cleaning under anaesthesia — $400", "Two extractions — $200", "Pain relief — $50"] },
  { id: 5, pet: "Peanut", src: "/pets/hamster.jpg", shelter: "Valley Small Animal Rescue", city: "Mesa", animal: "Small animals", type: "Supplies", urgency: "Ongoing",
    goal: 60, raised: 44, story: "Peanut's cage is on its last legs. A proper habitat with a solid wheel and deep bedding means a happier, healthier hamster.",
    breakdown: ["New habitat — $40", "Silent wheel — $12", "Bedding — $8"] },
  { id: 6, pet: "Luna", src: "/pets/husky.jpg", shelter: "West Valley Hope Shelter", city: "Glendale", animal: "Dogs", type: "Medication", urgency: "Ongoing",
    goal: 320, raised: 60, story: "Luna tested positive for heartworm. Treatment takes months of injections and strict rest — hard for a husky, but she'll make it with your help.",
    breakdown: ["Heartworm injections — $240", "Bloodwork — $50", "Calming aids for crate rest — $30"] },
  { id: 7, pet: "Sunny & Bean", src: "/pets/two-puppies.jpg", shelter: "Chandler Second Chance", city: "Chandler", animal: "Dogs", type: "Vaccines & microchip", urgency: "This month",
    goal: 210, raised: 210, story: "The doorstep puppies need their final vaccine round and microchips before they can go home together. Almost there!",
    breakdown: ["Vaccine boosters ×2 — $120", "Microchips ×2 — $60", "Deworming — $30"] },
  { id: 8, pet: "Tabby ward", src: "/pets/tabby-kitten.jpg", shelter: "Old Pueblo Pet Rescue", city: "Tucson", animal: "Cats", type: "Shelter repairs", urgency: "Ongoing",
    goal: 1200, raised: 380, story: "The cat room's air conditioner died in July. Tucson summers are brutal — help us replace it before next season.",
    breakdown: ["Replacement AC unit — $950", "Installation — $200", "Filters for a year — $50"] },
];
export const CAUSE_FILTERS = {
  city: ["Phoenix", "Tempe", "Mesa", "Scottsdale", "Chandler", "Gilbert", "Glendale", "Tucson"],
  animal: ["Dogs", "Cats", "Small animals"],
  type: ["Medication", "Surgery", "Dental", "Food & formula", "Vaccines & microchip", "Supplies", "Shelter repairs"],
  urgency: ["Urgent", "This month", "Ongoing"],
};
