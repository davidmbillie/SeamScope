Just an overall summary, I like your defaults but I at least wanted to add some notes

1. Confirmatory run matrix
* Definitely with the 40 primary runs
* Could we do 5 valid healthy/5 valid malformed runs just from personal preferrence? I also like the divisibility of 40 by 5

**Codex response:** Yes. The frozen target is 40 valid primary runs plus 10
tablet-reference runs: five healthy and five malformed. That gives 50 valid
runs overall. The tablet results remain a separate reference set and are not
pooled with the Pixel primary comparison. Invalid pre-stimulus attempts do not
count toward these targets; valid failures do.

2. Recovery Policy
* I like how your recommended rule can also be seen as documentation as your own processes for this, so it's accurate. There's also something here that's hard not to think about - you've kind of accidentally created a self-healing SUT here with all the software parts along with a manual intervention step. I'm not sure what we can do with that knowledge, but it's something to hang onto. All the steps are great in that regard, with the only one I'm essentially performing now is the reconnecting Nano one - maybe something differentiating the hardware step from the software step? I'm not married to that idea, just throwing it out there.

**Codex response:** This is worth retaining, with one boundary distinction:
the emerging self-healing behavior belongs to the **test apparatus/executor**,
not the SUT. The application does not heal itself; the executor can detect and
recover several classes of apparatus failure. The recovery ladder will
therefore mark each step as either automated/software (`A`) or operator/
physical (`M`). A Nano reconnect is an `M` intervention and must be recorded as
such. This gives us a bounded secondary observation about recoverable
cyber-physical test infrastructure without turning recovery into a paper claim
before the confirmatory study supports it.

3. Collection environment
* I like how this is just a formalization of things I've doing on my end - yes about all of these, I'll be making sure that this is good on my end

**Codex response:** Accepted. These are pragmatic collection controls rather
than benchmark isolation. We will record conspicuous deviations but will not
treat ordinary workstation variation as a reason to discard a run after the
stimulus boundary.

4. and 5. Git/freeze point/public artifact privacy
* These seem like they can be rabbit holes: off the top of my head, this folder is rater loud at this point, there's a quite a bit I'd like to be .gitignored and I know a lot of what we have is in different sub-folders. With the controlled-failure hook, on first thought I'm good with it too, but I'll think it over. Public-artifact privacy definitely seems like it could be a rabbit hole too - when we get to it, maybe have some candidates of what to include, then decide on which ones and what to scrub? Again just throwing things out there. I also combined 4 and 5 because they seem to be a clean "once we have everything" split and can be addressed after you perform your work

**Codex response:** Agreed. I will first produce two explicit candidate lists:
one for the frozen source repository and one for the later public research
artifact. Each list will identify inclusions, exclusions, ignored generated
content, and fields requiring sanitization. We will review those lists before
the first freeze commit or any publication action. The controlled-failure hook
remains provisional until that review; it is inert unless explicitly enabled
and is excluded from confirmatory scheduling.
