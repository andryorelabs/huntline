---
status: empty
sources: []
---

# Identity

<!--
Dossier section "identity". Front matter: status is empty, partial or complete;
sources lists any of cv, github, linkedin, interview, export.

One identity field per line, in this format:

- <name> [<tier>]: <value>

The name is a camelCase identifier. The Identity tier is one of:
- A: may appear in a CV only for name, email, phone, city, country and links;
  other tier A fields (for example streetAddress) are for forms only.
- B: sensitive, used only when a form requires it.
- C: never stored; the value is readiness only, written "ready: yes" or "ready: no".
- D: never answered automatically.

Never store passwords or tier C values. This file is listed in the data
directory .gitignore. Lines inside this comment are ignored.

Example:
- fullName [A]: Jane Example
- passportNumber [C]: ready: no
-->
