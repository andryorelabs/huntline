#let cv = json(sys.inputs.data)

#set page(margin: 1.8cm)
#set text(size: 10.5pt)

#let header = cv.at("header", default: (name: "", contact: (:)))

#if header.name != "" [
  = #header.name

  #header.contact.values().join(" | ")
] else [
  = Jane Example

  Senior Software Engineer
]

#let entry-title(entry) = {
  let title = entry.name
  if "role" in entry { title += ", " + entry.role }
  if "dates" in entry { title += " (" + entry.dates + ")" }
  title
}

#let render-entries(entries) = for entry in entries [
  === #entry-title(entry)

  #for bullet in entry.bullets [
    - #bullet.text
  ]
]

#let experience = cv.at("experience", default: ())
#let projects = cv.at("projects", default: ())
#let skills = cv.at("skills", default: ())
#let grouped = (experience + projects).map(entry => entry.bullets.map(bullet => bullet.id)).flatten()
#let loose = cv.bullets.filter(bullet => not grouped.contains(bullet.id))

#if experience.len() > 0 [
  == Experience

  #render-entries(experience)
]

#if projects.len() > 0 [
  == Projects

  #render-entries(projects)
]

#if loose.len() > 0 [
  == Highlights

  #for bullet in loose [
    - #bullet.text
  ]
]

#if skills.len() > 0 [
  == Skills

  #for group in skills [
    - *#group.name:* #group.items.join(", ")
  ]
]
