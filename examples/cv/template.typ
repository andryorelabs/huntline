#let cv = json(sys.inputs.data)

#set page(margin: 1.8cm)
#set text(size: 10.5pt)

= Jane Example

Senior Software Engineer

== Experience

#for bullet in cv.bullets [
  - #bullet.text
]
