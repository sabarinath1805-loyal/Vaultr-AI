# OpenChain Self-Certification Answers

This file records Vaultr's answers to the OpenChain self-certification
checklists for ISO/IEC 5230:2020 (open source licence compliance) and
ISO/IEC 18974:2023 (open source security assurance), and points to the file
that documents each answer.

Question wording below is paraphrased from the requirements and verification
material of each specification, as presented in the OpenChain online
self-certification questionnaires. When filling in the online form, match each
answer to the corresponding numbered clause rather than to the wording here.

Items marked **[REVIEW]** are answered YES but rest on a fact that Sabarinath
Babu should confirm before submitting.

Prepared September 2026 by Sabarinath Babu, Founder, Vaultr.

---

## ISO/IEC 5230:2020 (OpenChain licence compliance)

### Section 1: Programme foundation

**1.1 Policy**

1. Do you have a documented policy governing the open source licence
   compliance of the supplied software?
   **YES.** `OPEN-SOURCE-POLICY.md` is the documented policy and covers all
   software Vaultr supplies.

2. Do you have a documented procedure to make all programme participants aware
   of the existence of the open source policy?
   **YES.** `OPEN-SOURCE-POLICY.md` section 3 records that the sole participant
   is the policy's author and that any future maintainer is pointed to it and
   to `CONTRIBUTING.md` before their first merge.

**1.2 Competence**

3. Have you identified and documented the roles and responsibilities that
   affect the performance of the programme?
   **YES.** `OPEN-SOURCE-POLICY.md` section 3 lists every role and assigns all
   of them to Sabarinath Babu.

4. Have you identified the competencies needed for each of those roles?
   **YES.** `OPEN-SOURCE-POLICY.md` section 3 records the certifications and
   hands-on experience relied on for licence review and release management.
   **[REVIEW]** The listed certifications are security and governance
   credentials rather than licensing credentials; confirm you are comfortable
   presenting them, plus experience maintaining the AGPL code base, as the
   competence evidence.

5. Have you documented the assessed competence for each programme participant?
   **YES.** `OPEN-SOURCE-POLICY.md` section 3 is the competence record for the
   single participant, reconfirmed at each annual review.

**1.3 Awareness**

6. Do you have documented evidence that programme participants are aware of
   the open source policy?
   **YES.** `OPEN-SOURCE-POLICY.md` section 3 records awareness by authorship,
   and the review line at the bottom of the file is the dated confirmation.

7. Do you have documented evidence that participants are aware of the relevant
   open source objectives?
   **YES.** `OPEN-SOURCE-POLICY.md` sections 1 and 2 state the objectives (AGPL
   compliance, source availability, upstream attribution) that the sole
   participant wrote and reviews annually.

8. Do you have documented evidence that participants are aware of the
   contribution expected of them to the programme's effectiveness?
   **YES.** `OPEN-SOURCE-POLICY.md` section 3 assigns the pre-release check,
   licence review, and annual review to Sabarinath Babu by name.

9. Do you have documented evidence that participants are aware of the
   implications of not following the programme's requirements?
   **YES.** `OPEN-SOURCE-POLICY.md` section 7 states that a non-compliant
   licence blocks the release and must be removed from any published release.

**1.4 Programme scope**

10. Do you have a written statement that clearly defines the scope and limits
    of the programme?
    **YES.** `OPEN-SOURCE-POLICY.md` section 4 lists the components and
    dependencies in scope and what is excluded.

**1.5 Licence obligations**

11. Do you have a process for determining the obligations, restrictions, and
    rights granted by each identified licence?
    **YES.** `OPEN-SOURCE-POLICY.md` section 6 sets out how each licence class
    is assessed for AGPL-3.0 compatibility and what obligation it carries.

12. Do you have documentation for the procedure for identifying and recording
    the licence obligations of each open source component?
    **YES.** `OPEN-SOURCE-POLICY.md` sections 5 and 6 describe the
    `license-checker` run and manual review, and `NOTICES.md` is the record it
    produces.

### Section 2: Relevant tasks defined and supported

**2.1 Access**

13. Do you have a process for external parties to make inquiries regarding
    open source licence compliance of the supplied software?
    **YES.** `OPEN-SOURCE-POLICY.md` section 11 directs inquiries to
    Sabarinath.1805@gmail.com.

14. Is the method for external inquiries publicly available?
    **YES.** `OPEN-SOURCE-POLICY.md`, `NOTICES.md`, and `CONTRIBUTING.md` all
    publish the contact email in the public GitHub repository.

15. Is there an assigned internal responsibility for responding to external
    inquiries?
    **YES.** `OPEN-SOURCE-POLICY.md` section 11 names Sabarinath Babu as the
    person responsible for responding.

**2.2 Effectively resourced**

16. Have you identified and documented the roles responsible for performing
    the programme's tasks?
    **YES.** `OPEN-SOURCE-POLICY.md` section 3 assigns every programme task to
    Sabarinath Babu.

17. Have you identified legal expertise to address internal and external open
    source compliance matters?
    **YES.** `OPEN-SOURCE-POLICY.md` section 12 ("Legal expertise") states
    that routine questions are handled by Sabarinath Babu and that external
    legal counsel is engaged as required for non-routine matters.

18. Do you have a procedure for ensuring the programme is sufficiently staffed
    and funded?
    **YES.** `OPEN-SOURCE-POLICY.md` section 13 records that the programme is
    self-funded by the founder with time set aside for the pre-release check
    and annual review. **[REVIEW]** Confirm you are comfortable presenting
    founder self-funding as the resourcing procedure.

19. Do you have a process for reviewing and updating the policy and its
    supporting procedures?
    **YES.** `OPEN-SOURCE-POLICY.md` section 13 commits to an annual review and
    to earlier review when a licence changes, with the date recorded in each
    file.

20. Do you have a process for handling internal open source compliance
    inquiries?
    **YES.** `OPEN-SOURCE-POLICY.md` section 11 notes that with one
    participant there are no internal inquiries and that decisions are
    recorded in commits and pull requests.

### Section 3: Open source content review and approval

**3.1 Bill of materials**

21. Do you have a process for creating and managing a bill of materials that
    includes each open source component (and its licence) in the supplied
    software?
    **YES.** `OPEN-SOURCE-POLICY.md` section 5 defines the npm lockfiles as the
    bill of materials and the pre-release `license-checker` run as the licence
    inventory.

22. Do you have documented evidence of that process being followed?
    **YES.** `NOTICES.md` contains the dated `license-checker` output for the
    frontend and backend together with the manual review notes.

**3.2 Licence compliance**

23. Do you have a documented procedure for handling distribution in binary
    form?
    **YES.** `OPEN-SOURCE-POLICY.md` section 8 covers container images and
    compiled bundles and ties each to a tagged commit with `LICENSE` and
    `NOTICES.md`.

24. Do you have a documented procedure for handling distribution in source
    form?
    **YES.** `OPEN-SOURCE-POLICY.md` section 8 covers source distribution
    through the GitHub repository and tagged releases.

25. Do you have a documented procedure for handling integration with other
    open source (for example linking or combining)?
    **YES.** `OPEN-SOURCE-POLICY.md` sections 6 and 8 restrict combination to
    AGPL-3.0-compatible licences and explain how dual-licensed packages are
    handled.

26. Do you have a documented procedure for handling modified open source?
    **YES.** `OPEN-SOURCE-POLICY.md` section 8 covers Vaultr as a modification
    of Mike and how any future patched dependency would be recorded in
    `NOTICES.md`.

27. Do you have a documented procedure for handling open source that carries an
    attribution requirement?
    **YES.** `OPEN-SOURCE-POLICY.md` section 8 and `NOTICES.md` record upstream
    credit and dependency attribution, with package notices preserved in
    `node_modules`.

### Section 4: Compliance artifact creation and delivery

**4.1 Compliance artifacts**

28. Do you have a documented procedure describing how the compliance artifacts
    are prepared and distributed with the supplied software?
    **YES.** `OPEN-SOURCE-POLICY.md` section 9 names `LICENSE` and `NOTICES.md`
    as the artifacts and explains that they ship in every tag and build.

29. Do you have a documented procedure for archiving copies of the compliance
    artifacts for as long as the software is offered or the licence requires?
    **YES.** `OPEN-SOURCE-POLICY.md` section 9 relies on git tags on GitHub as
    the archive. **[REVIEW]** The repository has git tags (v0.1.0 to v0.4.0)
    but no GitHub Releases pages; confirm that tags alone are the archiving
    mechanism you want to declare, or publish Releases for existing tags.

### Section 5: Understanding open source community engagements

**5.1 Contributions**

30. Do you have a documented open source contribution policy?
    **YES.** `OPEN-SOURCE-POLICY.md` section 10 covers both inbound and
    outbound contributions.

31. Do you have a documented procedure that governs open source contributions?
    **YES.** `CONTRIBUTING.md` sets out the licence requirements, the
    `license-checker` step, attribution rules, and the pull request process.

32. Do you have a documented procedure to make programme participants aware of
    the contribution policy?
    **YES.** `CONTRIBUTING.md` is published at the repository root and
    `OPEN-SOURCE-POLICY.md` section 3 requires any future maintainer to read it
    before their first merge.

### Section 6: Adherence to the specification requirements

**6.1 Conformance**

33. Do you have documented evidence affirming that the programme meets all the
    requirements of the specification?
    **YES.** `OPENCHAIN-ANSWERS.md` (this file) together with
    `OPEN-SOURCE-POLICY.md` is that evidence.

34. Do you have documented evidence affirming that the programme has been
    reviewed within the last 18 months?
    **YES.** Every policy file ends with a review line dated September 2026
    and signed by Sabarinath Babu.

---

## ISO/IEC 18974:2023 (OpenChain security assurance)

### 4.1 Programme foundation

**4.1.1 Policy**

1. Do you have a documented policy governing the security assurance of the
   supplied software?
   **YES.** `SECURITY-POLICY.md` is the documented security assurance policy.

2. Do you have a documented procedure to make all programme participants aware
   of the existence of the security assurance policy?
   **YES.** `SECURITY-POLICY.md` section 3 records awareness by authorship and
   requires any future maintainer to read it before being granted write
   access.

**4.1.2 Competence**

3. Have you identified and documented the roles and responsibilities that
   affect the performance of the programme?
   **YES.** `SECURITY-POLICY.md` section 3 lists every role and assigns all of
   them to Sabarinath Babu.

4. Have you identified the competencies needed for each of those roles?
   **YES.** `SECURITY-POLICY.md` section 3 records CISM, ISC2 Certified in
   Cybersecurity, and Microsoft Cybersecurity Architect Expert as the
   competence relied on.

5. Have you documented the assessed competence for each programme participant?
   **YES.** `SECURITY-POLICY.md` section 3 is the competence record for the
   single participant.

**4.1.3 Awareness**

6. Do you have documented evidence that programme participants are aware of
   the security assurance policy?
   **YES.** `SECURITY-POLICY.md` section 3 records awareness by authorship,
   confirmed by the dated review line.

7. Do you have documented evidence that participants are aware of the relevant
   security assurance objectives?
   **YES.** `SECURITY-POLICY.md` sections 1 and 8 state the objectives and the
   metrics used to check them.

8. Do you have documented evidence that participants are aware of the
   contribution expected of them to the programme's effectiveness?
   **YES.** `SECURITY-POLICY.md` section 3 assigns triage, remediation, testing,
   release approval, and review to Sabarinath Babu by name.

9. Do you have documented evidence that participants are aware of the
   implications of not following the programme's requirements?
   **YES.** `SECURITY-POLICY.md` section 4.5 states that a release with an open
   critical vulnerability is not tagged.

**4.1.4 Programme scope**

10. Do you have a written statement that clearly defines the scope and limits
    of the programme?
    **YES.** `SECURITY-POLICY.md` section 2 lists every component and
    dependency in scope and what is excluded.

**4.1.5 Standard practice implementation**

11. Do you have a method for identifying structural and technical threats to
    the supplied software?
    **YES.** `SECURITY-POLICY.md` section 4.1 uses CodeQL for code-level
    weaknesses, Dependabot for dependency vulnerabilities, and OpenSSF
    Scorecard for repository-level risks.

12. Do you have a method for detecting the existence of known vulnerabilities
    in the supplied software?
    **YES.** `SECURITY-POLICY.md` section 4.1 relies on GitHub Dependabot
    alerts and CodeQL code scanning. **[REVIEW]** Dependabot alerts and GitHub
    secret scanning are repository settings that could not be verified from
    the local checkout; confirm both show as enabled under Settings, Code
    security.

13. Do you have a method for following up on identified known vulnerabilities?
    **YES.** `SECURITY-POLICY.md` sections 4.2 and 4.3 track each alert to
    closure within the remediation windows.

14. Do you have a method to communicate identified known vulnerabilities to
    your customer base when warranted?
    **YES.** `SECURITY-POLICY.md` section 4.4 and `SECURITY.md` use GitHub
    Security Advisories for disclosure.

15. Do you have a method for analysing the supplied software for newly
    published known vulnerabilities after it has been released?
    **YES.** `SECURITY-POLICY.md` section 4.5 records that Dependabot keeps
    alerting on the default branch after release and that only the default
    branch is supported.

16. Do you have a method for continuous and repeated security testing of all
    supplied software before release?
    **YES.** `SECURITY-POLICY.md` section 4.5 runs CodeQL, gitleaks, and the CI
    test suites on every push and pull request.

17. Do you have a method to verify that identified risks have been addressed
    before release?
    **YES.** `SECURITY-POLICY.md` section 4.5 defines the pre-release check for
    zero open critical Dependabot or CodeQL alerts.

18. Do you have a method for exporting information about identified risks to
    third parties as appropriate?
    **YES.** `SECURITY-POLICY.md` section 4.6 relies on public GitHub Security
    Advisories plus the component record in `NOTICES.md`. **[REVIEW]** Confirm
    you are comfortable that advisories and lockfiles are sufficient, since
    Vaultr does not publish a formal SBOM document (for example SPDX or
    CycloneDX).

19. Do you have documented procedures for the above methods that programme
    participants can follow?
    **YES.** `SECURITY-POLICY.md` section 4 is that documented procedure, and
    the workflows it names live in `.github/workflows/`.

### 4.2 Relevant tasks defined and supported

**4.2.1 Access**

20. Do you have a process for external parties to make inquiries or reports
    about the security of the supplied software?
    **YES.** `SECURITY.md` gives the reporting email and the GitHub private
    reporting route. **[REVIEW]** GitHub private vulnerability reporting is a
    repository setting that could not be verified locally; confirm it is
    enabled or remove that route from `SECURITY.md`.

21. Is the method for external inquiries publicly available?
    **YES.** `SECURITY.md` is published at the root of the public repository.

22. Is there an assigned internal responsibility for responding to external
    inquiries?
    **YES.** `SECURITY-POLICY.md` section 6 names Sabarinath Babu as the person
    responsible for responding, within 48 hours.

**4.2.2 Effectively resourced**

23. Have you identified and documented the roles responsible for performing
    the programme's tasks?
    **YES.** `SECURITY-POLICY.md` section 3 assigns every task to Sabarinath
    Babu.

24. Do you have documented evidence that the persons performing those tasks
    are competent?
    **YES.** `SECURITY-POLICY.md` section 3 records the security certifications
    relied on.

25. Do you have a procedure for ensuring the programme is sufficiently staffed
    and funded?
    **YES.** `SECURITY-POLICY.md` section 7 records founder self-funding and
    the commitment to update the supported-versions table if the programme
    cannot be sustained. **[REVIEW]** Same consideration as ISO 5230 question
    18.

26. Do you have a process for reviewing and updating the policy and its
    supporting procedures?
    **YES.** `SECURITY-POLICY.md` section 10 commits to an annual review and to
    earlier review after any critical vulnerability or tooling change.

27. Do you have a process for handling internal security inquiries?
    **YES.** `SECURITY-POLICY.md` section 6 notes that with one participant
    there are no internal inquiries and decisions are recorded in commits,
    pull requests, and advisories.

### 4.3 Open source content review and approval

**4.3.1 Bill of materials**

28. Do you have a process for creating and managing a bill of materials that
    includes each open source component in the supplied software?
    **YES.** `SECURITY-POLICY.md` section 5 defines the npm lockfiles as the
    bill of materials and `NOTICES.md` as the per-release summary.

29. Do you have documented evidence of that process being followed?
    **YES.** `NOTICES.md` holds the dated component and licence summary for the
    frontend and backend.

**4.3.2 Security assurance**

30. Do you have a documented procedure for handling the detection and
    resolution of known vulnerabilities in the supplied software?
    **YES.** `SECURITY-POLICY.md` sections 4.1 to 4.3 cover detection,
    tracking, and remediation deadlines by severity.

31. Do you have a documented procedure for how the supplied software is tested
    for security before release?
    **YES.** `SECURITY-POLICY.md` section 4.5 describes the CodeQL, gitleaks,
    CI, and end-to-end workflows and the pre-release check.

32. Do you have a documented procedure for how known vulnerabilities are
    tracked to closure?
    **YES.** `SECURITY-POLICY.md` section 4.2 tracks each finding in the
    Dependabot, code scanning, or advisory record until fixed or dismissed with
    a reason.

33. Do you have a documented procedure for how vulnerabilities are
    communicated to users of the supplied software?
    **YES.** `SECURITY-POLICY.md` section 4.4 and `SECURITY.md` describe
    disclosure through GitHub Security Advisories.

### 4.4 Adherence to the specification requirements

**4.4.1 Conformance**

34. Do you have documented evidence affirming that the programme meets all the
    requirements of the specification?
    **YES.** `OPENCHAIN-ANSWERS.md` (this file) together with
    `SECURITY-POLICY.md` and the evidence sources listed in its section 9 is
    that record.

**4.4.2 Duration**

35. Do you have documented evidence affirming that the programme has been
    reviewed within the last 18 months?
    **YES.** `SECURITY-POLICY.md` and `SECURITY.md` end with a review line
    dated September 2026 and signed by Sabarinath Babu.

---

## Items flagged for manual review before submission

| Ref | Item | What to confirm |
| --- | --- | --- |
| 5230 Q4; 18974 Q4, Q24 | Competence evidence | You are comfortable citing the listed certifications plus maintenance experience as competence for licence review. |
| 5230 Q18; 18974 Q25 | Resourcing | Founder self-funding is the resourcing procedure you want to declare. |
| 5230 Q29 | Archiving | Git tags exist but no GitHub Releases pages; decide whether tags alone are the archive or publish Releases. |
| 18974 Q12 | Dependabot and secret scanning | Both are enabled under the repository's Code security settings (not verifiable from the local checkout). |
| 18974 Q18 | Risk export | Advisories plus lockfiles are acceptable in place of a formal SPDX or CycloneDX SBOM. |
| 18974 Q20 | Private vulnerability reporting | The GitHub private reporting route named in `SECURITY.md` is actually enabled. |
| `NOTICES.md` | `buffers@0.1.1` | This transitive dependency of `exceljs` has no licence text and its upstream repository is gone; it is recorded as an open item and should be resolved before the next release. |

Last reviewed: September 2026 — Sabarinath Babu, Founder, Vaultr
