# What YouVersion can show in the game

Inspected 2026-10-10. This note answers GitHub issue 3 for a single-player Godot game: a scripture object opens a matching NIV passage, the first reading grants Scripture XP and files the passage in a journal, and later readings show the text and grant nothing more. It reports what the YouVersion Platform publishes. It is not a build plan and it is not legal advice.

The Platform can serve NIV passage text to a registered app after that app's organization accepts the Biblica publisher license. Whenever the wording is on screen, the game shows that version's copyright attribution with it. A Scripture XP grant, and a journal entry that records the reference and that it was read, may sit beside the passage. The public Developer Terms do not grant a right to keep a copy of the NIV wording. The Biblica agreement that would settle storage, layout, and offline use is delivered inside the Platform as license HTML, and that HTML was not readable from a public page.

## Sources and how they were read

Developer documentation was read from the pages linked by [the overview](https://developers.youversion.com/overview) and from the site's [llms.txt](https://developers.youversion.com/llms.txt) and [sitemap](https://developers.youversion.com/sitemap.xml). The sitemap's `lastmod` for those pages is 2026-10-08, and the overview says it was last modified on October 8, 2026.

The Platform portal at [platform.youversion.com](https://platform.youversion.com) is a client-rendered app. Its HTML shell does not contain the terms. The Developer Terms, the support FAQ, the new-application form, the get-started steps, and the license labels below are the text in the live bundle `https://platform.youversion.com/assets/App-BDSNWjYR.js`, fetched the same day. The terms document in that bundle is marked `YVP-Developer-Terms-of-Use-8.17.26.html` and is last modified on August 17, 2026. It is what [https://platform.youversion.com/terms](https://platform.youversion.com/terms) and [https://platform.youversion.com/?tos=1](https://platform.youversion.com/?tos=1) render.

The [Bible App Terms of Use](https://www.bible.com/terms) (last modified April 2, 2020, Life.Church Operations, LLC) govern use of YouVersion sites, services, and mobile applications by Bible App users. The Platform Developer Terms are a separate agreement with YouVersion, Inc. The Developer Terms say they cover the platform and the developer tools, and that biblical works are a further license from the publisher. This note does not treat the 2020 Bible App terms as the NIV license.

No App Key was available, so the live NIV `copyright` string and the Biblica agreement HTML were not fetched.

## NIV text is available only after the publisher license

The [overview](https://developers.youversion.com/overview) describes the REST API as licensed, official access to more than a thousand Bible versions in many languages, including the NIV.

The [quick reference](https://developers.youversion.com/quick-reference) lists Bible ID **111** as abbreviation NIV, name New International Version.

The Platform licenses screen labels license **1** as publisher Biblica, with the version chips "NIV - New International Version" and "NIrV - New International Readers Version." That label map is in the portal bundle. The agreement body is not in the map. [Get started](https://platform.youversion.com/platform/get-started) calls this "Express Bible licensing" and points at [Bible licenses](https://platform.youversion.com/platform/licenses): if the product will implement Bibles, the developer signs up for one of those licenses. The [licenses API](https://developers.youversion.com/api/licenses) says these licenses are how developers get access to content such as Bibles. A license object includes `id`, `name`, `version`, `organization_id`, `html`, `bible_ids`, `uri`, `agreed_dt`, and `yvp_user_id`. The portal renders `html` in the review dialog and, when `html` is missing, shows "No agreement details are available for this license."

[API usage](https://developers.youversion.com/api-usage) says to accept the appropriate license agreements, then call the Bible collection to list the versions available to the app.

[Error codes](https://developers.youversion.com/error-codes) separate metadata from text:

- `GET /v1/bibles/{bible_id}` returns 200 with the version's title, abbreviation, and copyright even when the app is not licensed for that Bible.
- Content endpoints, including `GET /v1/bibles/{bible_id}/passages/{usfm}`, return **403** when the organization has not accepted the relevant publisher license. The documented example body is `{"message": "Access denied for 111"}`. The number is the Bible ID that was refused.
- `GET /v1/bibles?language_ranges[]=en` without `all_available` returns only Bibles the app is licensed for. `all_available=true` returns the catalog. A Bible that appears only in the second list still needs the publisher license. `language_ranges[]` is required on both calls; omitting it returns 422.

The [organizations API](https://developers.youversion.com/api/organizations) describes publishing partners. Its filter example uses `bible_ids[]=111`, and its sample organization name is "Biblica, Inc." That sample is documentation data, not a live NIV record.

The [support FAQ](https://platform.youversion.com/support) says Bible texts are not automatically available on the Platform. A publisher has to opt in. The same FAQ says not every Bible in the Bible App is therefore on the Platform.

## API surface the game would use

There is no Godot SDK. The [SDK introduction](https://developers.youversion.com/sdks/introduction) lists Swift, Kotlin, JavaScript, TypeScript types, React, and React Native (Expo). The [overview](https://developers.youversion.com/overview) says to call the REST API for full control or for a platform that does not yet have an SDK.

[Authentication](https://developers.youversion.com/authentication) and [API usage](https://developers.youversion.com/api-usage) require the App Key on every request as `X-YVP-App-Key`. The documented production host is `https://api.youversion.com`. The [Bibles reference](https://developers.youversion.com/api/bibles) also lists `https://api-dev.youversion.com`. A missing or unrecognized key is 401. An archived or unknown app behind a key that still authenticates is 412.

### Passage text

`GET /v1/bibles/{bible_id}/passages/{passage_id}` returns the passage. On the REST reference the `format` query is `text` or `html`, default **text**. Headings and notes are included only when `format=html`. They are omitted when `format=text`. Defaults for `include_headings` and `include_notes` are false, except a chapter or introduction reference, where those defaults are true. The documented response fields are `id` (canonical passage id), `content` (the wording, text or HTML), and `reference` (a human-readable reference). The operation description also says the response includes metadata such as verse ranges and formatting details.

The [JavaScript SDK](https://developers.youversion.com/sdks/javascript) documents the same passage ids, and its default format is **html** rather than text. It documents three id shapes:

- one verse, `JHN.3.16`
- a verse range, `GEN.1.1-5`
- a whole chapter, `GEN.1`

Book codes are the 3-character USFM identifiers in the [USFM reference](https://developers.youversion.com/usfm-reference). John is `JHN`. Book, chapter, and verse resources do not include the wording. The passages endpoint is the one that does.

[Search](https://developers.youversion.com/search-apis) returns verse hits as a USFM reference only. It does not return passage text. The text still comes from the passages endpoint, under the same license check. Verse search with a Bible the app cannot access returns 404 with the meaning "not available to this app," which is a different status from the 403 on the passages endpoint.

### Version metadata, structure, and the rest of the reference

Also on the [Bibles reference](https://developers.youversion.com/api/bibles):

| Call | What it returns |
| --- | --- |
| `GET /v1/bibles` | Versions. `language_ranges[]` is required. `license_id` filters by license. `all_available` toggles the whole catalog versus the app's licenses. Page size is 1–99, or `*` when three or fewer `fields[]` are requested. |
| `GET /v1/bibles/{id}` | One version: `copyright` (short publisher text), `promotional_content` (longer copyright or publisher notice), `info` (often a reader footer), `publisher_url`, titles, abbreviation, language, book list, `youversion_deep_link`, `organization_id`. This call does not include the Bible text. |
| `GET /v1/bibles/{id}/index` | Books, chapters, and verse counts, plus `text_direction`. |
| Books, chapters, verses | Structure and passage ids such as `GEN.1.1`. No verse wording. |

[API usage](https://developers.youversion.com/api-usage) says list endpoints generally allow up to 100 items per page via `page_size` and `page_token`. The Bibles collection schema is tighter: numeric page size 1–99.

The interactive reference groups the rest of the surface as data exchange, fonts, highlights, languages, licenses, organizations, permissions, search, verse of the days, and apps. Verse of the day returns a day number and a `passage_id`, not the verse wording ([verse of the days](https://developers.youversion.com/api/verse-of-the-days)). Highlights and permissions act on a signed-in user's data. The described game does not need sign-in, highlights, or data exchange to open a passage.

The [support FAQ](https://platform.youversion.com/support) says Platform accounts have a limit of 200 requests per hour, and that a higher limit is a request to YouVersion. [Get started](https://platform.youversion.com/platform/get-started) says marking the app live is how an app is given larger API rate limits. It does not state the larger number. [Error codes](https://developers.youversion.com/error-codes) say a 429 is plain text (`Rate limit exceeded.`), carries `Retry-After` in seconds, and should be retried with backoff. The same page says to cache responses where you can, and to avoid one request per Bible version when a single call would do.

One page disagrees with the rest of the docs. The [quick reference](https://developers.youversion.com/quick-reference) says "While no official SDKs are available" and points at a `/getting-started` path. The overview and the SDK introduction, republished with the same sitemap date, document the official SDKs. For this game the REST path is the one the overview assigns to platforms without an SDK. The quick reference is still the page that publishes the NIV id 111 table, the "cache responses when possible" line, and the 429 `Retry-After` note.

## Attribution

Every SDK copyright page uses the same rule. The [JavaScript](https://developers.youversion.com/sdks/javascript/guides/copyright-and-attribution), [Swift](https://developers.youversion.com/sdks/swift/guides/copyright-and-attribution), [Kotlin](https://developers.youversion.com/sdks/kotlin/guides/copyright-and-attribution), and [React](https://developers.youversion.com/sdks/react/guides/copyright-and-attribution) guides say: when displaying Bible text, always display that Bible version's copyright attribution in accordance with the license agreement.

The fields are:

- `copyright` — brief attribution, shown near the verses.
- `promotional_content` — the fuller copyright or publisher notice, used on a version-details or about screen, and used as the nearby fallback when `copyright` is empty.

The JavaScript display helper prefers `copyright`, falls back to `promotional_content`, and fails if neither contains attribution. It fetches version metadata on every call so the attribution is current, and it does not cache that metadata ([display guide](https://developers.youversion.com/guides/display-bible-html), [JavaScript copyright guide](https://developers.youversion.com/sdks/javascript/guides/copyright-and-attribution)). The Swift and Kotlin guides say some public-domain versions may omit copyright text, and that a successful metadata response with a missing field is different from a failed lookup. The quick-start sample that prints "Public Domain" is Bible ID 3034, the Berean Standard Bible, not the NIV.

The web display guide shows the attribution in its own element beside the passage HTML, as text, not as HTML. Components that draw the passage without attribution leave that duty on the caller. A Godot client is in that second group: it draws the passage itself, so it draws the attribution itself, on every screen where the wording appears, including a later reading that grants no XP.

If the game renders the Platform's HTML on a web page, the display guide also requires the Bible CSS (`https://cdn.youversion.com/platform/1/bible.css`) and the Fonts API stylesheet. Untitled Serif is the intended typeface for that path, font ID 1. The guide says to load it from the Fonts API and not to download or self-host its font files. The [Fonts API](https://developers.youversion.com/api/fonts) serves the family metadata and a browser stylesheet of CDN `woff2` URLs. That font rule is about Untitled Serif. It does not by itself require a Godot client that uses `format=text` to ship that typeface.

The actual NIV copyright sentence is the `copyright` value on `GET /v1/bibles/111`. Error codes say that metadata call can succeed when the content call is still forbidden. This inspection had no App Key, so the sentence itself is not copied here.

## Caching and offline use

Three different statements are published, and they are about different things.

**HTTP caching of API responses is described.** [Error codes](https://developers.youversion.com/error-codes) document 304 Not Modified: if the client sends `If-None-Match` or `If-Modified-Since` and nothing changed, the body is empty and the client reuses what it has. The same page says to cache responses to reduce 429s. The [quick reference](https://developers.youversion.com/quick-reference) lists "Cache responses when possible" as a best practice. Responses advertise `Accept-Ranges: bytes`, and 206 is documented for a `Range` request. That is conditional reuse of an API response, with revalidation.

**Attribution is fetched again so it stays current.** `getPassageDisplay` does not cache version metadata or attribution, and it loads the version on every call ([display guide](https://developers.youversion.com/guides/display-bible-html)).

**The font files are not for self-hosting.** The display guide forbids downloading or self-hosting Untitled Serif.

**A durable copy of the NIV wording is not granted by the Developer Terms.** Those terms, quoted in the next section, license the platform and the tools. They say biblical works come from their owners and licensors. Nothing in the public docs authorizes bundling NIV text in the game for offline play, or writing the wording into a save file. The publisher agreement's `html` is the document that would allow or refuse that storage. It was not available on a public URL.

No developer-doc page uses "offline" as a Bible-text right. The Bible App's own marketing mentions offline reading inside the Bible App. That is not a Platform grant to this game.

## Scripture XP and a journal beside the text

The public docs and the Developer Terms never mention experience points, journals, or games. They do show non-scripture UI next to the passage: the attribution paragraph, and reader styling around the verses ([display guide](https://developers.youversion.com/guides/display-bible-html)).

For the design in issue 3:

- **Scripture XP on the first reading** is game state. No published Platform sentence forbids a reward that is not itself Bible text and that does not charge the player. The text, whenever it is shown, still carries the version attribution. A later reading that grants no further XP is a game rule. The Platform rule on that later visit is the same display rule: the wording and its attribution.
- **A journal entry that records the reference** (for example `JHN.3.16`), the human-readable `reference`, and the fact that it was read, is also game state. Search already returns references without wording, and the passages call is what turns a reference into text ([search APIs](https://developers.youversion.com/search-apis)).
- **A journal that stores the NIV wording** is a copy of the biblical work. The Developer Terms do not grant that copy. Whether Biblica's license allows a local copy, a time limit, or a minimum excerpt is inside the license `html`, which this research could not read.

The [support FAQ](https://platform.youversion.com/support) answers "Can I modify the visual structure of Bible Text?" with: look at the specific license agreement signed per publisher. So a layout that places XP or a journal control beside the verses is not forbidden by the FAQ, and it is also not cleared by the FAQ. The publisher agreement is the document that would restrict that layout.

The same FAQ defines non-commercial use by the end-user experience. An application that integrates Platform services must be free to the end user (no subscriptions, purchases, or upgrades), must not place Scripture or Scripture-dependent features behind paywalls, and must not include advertising, sponsorships, or other monetization. "Scripture may not be used in a way that enables revenue generation, directly or indirectly." The new-application form on [Apps](https://platform.youversion.com/platform/apps) says "YouVersion is not accepting commercial applications at this time," and it requires three confirmations: the application will be truly non-commercial per the definition provided and free of charge in all respects; it will not offer any materials behind paywalls; it will not run any advertisements as part of the Platform-integrated website or mobile application. The form's lead-in is published as the incomplete sentence "We confirm that the use of the Licensed IP ..."

A free game that grants Scripture XP and does not sell, gate, or advertise the passage fits those published commercial tests. A game that charges, or that uses the passage to produce revenue, does not. The Developer Terms add a separate sentence for a paid application: if the developer charges a fee for any application that uses the platform IP, the application must conspicuously tell users that the YouVersion Bible App is provided at no cost. That sentence does not relax the portal's current refusal of commercial applications.

## What the terms forbid

The operative developer agreement is YouVersion Platform Terms of Use, `YVP-Developer-Terms-of-Use-8.17.26.html`, last modified August 17, 2026, published at [https://platform.youversion.com/terms](https://platform.youversion.com/terms). "YVP Terms" are extra restrictions for a particular tool, including geographic, branding, security, and technical requirements. If they conflict with the Terms of Use, the YVP Terms govern for that tool. The Biblica license is one of those further terms. Its text was not on the public page.

From the Terms of Use, the limits that bear on this game:

- The license is limited, revocable, non-transferable, and non-exclusive. YouVersion reserves every right it does not grant. The developer may not sublicense without prior written approval.
- The agreement "is limited to the YV IP." YouVersion is "not providing You rights in biblical works or works other than YV IP, which You must obtain from their respective owners and licensors." Accessing a Bible text through the tools is also consent to share developer personal information with that publisher so the publisher can check eligibility and adherence to the publisher's guidelines.
- Credentials and access keys stay confidential and are not shared with any third party. Loss, theft, or misuse is reported to YouVersion. Browser samples in the [display guide](https://developers.youversion.com/guides/display-bible-html) and the [JavaScript quick start](https://developers.youversion.com/sdks/javascript/quick-start) still place an App Key in page code. The terms' confidentiality sentence is the prohibition. A Godot build that ships the key to players shares it with those players.
- The developer enables whatever usage reporting is built into the platform IP.
- YouVersion marks, including "YouVersion," "YVP," "Life.Church," and "The Bible App," are used only when the YVP Terms for a particular tool explicitly allow that use, and then only with that tool. The application is not marketed as sponsored, endorsed, or partnered with YouVersion.
- Except where the license expressly allows it: no reverse engineering or derivative works of the platform IP; no renting, selling, sublicensing, assigning, distributing, publishing, or otherwise making the platform IP available to third parties; no removing notices or disclaimers from the platform IP; no use that infringes a third party; no service that replicates or competes with YouVersion, the YouVersion Bible App, or the Platform; no tampering with or circumventing security; no unlawful, pornographic, or mission-contrary material, and no malware, sent through an application that uses the tools.
- AI may be used to write the application's code and to generate content, and for no other purpose, except the narrow scripture case: AI may retrieve and display scripture verbatim from a licensed biblical work, word for word, 100% accurate to and unaltered from the licensed source. The tools are not used to train, develop, refine, or improve any AI, and they are not used with AI in a way that breaks the law or a third party's rights. Anything beyond that needs YouVersion's prior written approval. Open-ended chat with a user, using the tools and AI, is outside the permission.
- On termination the license ends immediately, including the right to use the platform IP in the application. YouVersion may stop offering any of it, or change it, with or without notice.
- Export and sanctions limits apply, including a ban on military end uses.
- The agreement is governed by Oklahoma law, and lawsuits are brought in Oklahoma County. Claims are individual, not class claims. The developer may not assign the agreement without written consent.

From the portal, on top of that agreement:

- Commercial applications are not being accepted. The integration stays free to the end user, with no paywall around scripture or anything else, no advertising or sponsorship, and no use of scripture to generate revenue directly or indirectly ([support FAQ](https://platform.youversion.com/support), [new application form](https://platform.youversion.com/platform/apps)).
- Bible text is shown with the version copyright required by the publisher license. Untitled Serif font files are not self-hosted ([display guide](https://developers.youversion.com/guides/display-bible-html)).
- Passage text for a Bible the app has not licensed is refused ([error codes](https://developers.youversion.com/error-codes)).

The 2020 [Bible App terms](https://www.bible.com/terms) separately forbid, for users of the Bible App, copying material on YouVersion, commercial activities, and a list of unlawful uses. Those are the consumer terms. The Platform's own developer agreement is the one cited above, and it sends biblical-text rights to the publisher.

## What a primary source did not settle

- The Biblica / NIV agreement HTML (`GET /v1/licenses` field `html`, rendered on [the licenses screen](https://platform.youversion.com/platform/licenses)). That is the document that would state verse limits, required NIV copyright wording, whether a local or offline copy is allowed, and whether a game layout is restricted. The public reference shows the field. The example value is the placeholder `"html"`. No App Key was available to read license 1.
- The live NIV `copyright` and `promotional_content` strings on Bible ID 111.
- A numeric rate limit after the app is marked live. The get-started step says the limit becomes larger. The FAQ states 200 requests per hour for accounts. [Error codes](https://developers.youversion.com/error-codes) document 429 handling and do not state the quota.
- Whether the support FAQ in the bundle matches a Google Sheet behind `/api/fetch-faq-sheets`. That URL returned 404 on the public host. The support page initializes from the FAQ compiled into the bundle, which is the text quoted above.
- A REST reference example of a verse-range id. The range form `GEN.1.1-5` is documented on the [JavaScript SDK](https://developers.youversion.com/sdks/javascript) page, which calls the passages API. The Bibles reference describes the passage id as verse or chapter USFM and uses single-verse examples.
