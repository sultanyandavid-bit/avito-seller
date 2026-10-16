import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildListing,
  parseListings,
  emptyListings,
} from "../lib/listings/types";
import { validateMediaFile } from "../lib/media/assets";
import { parseMedia, emptyMedia } from "../lib/media/types";
const listing = {
  name: "Велосипед",
  category: "Спорт",
  description: "Городской велосипед",
  specifications: "Колёса 28 дюймов",
  condition: "Был в использовании",
  price: 24000,
  terms: "Самовывоз после согласования",
  instructions: "Не придумывать гарантию",
  style: "professional" as const,
};
test("listing templates use only supplied facts and refuse missing sale details", () => {
  const r = buildListing(listing);
  assert.match(r.description, /28 дюймов/);
  assert.match(r.description, /24\s000/);
  assert.ok(!r.description.toLowerCase().includes("гарант"));
  assert.throws(() => buildListing({ ...listing, condition: "" }));
  assert.throws(() => buildListing({ ...listing, terms: "" }));
  assert.throws(() => buildListing({ ...listing, specifications: "" }));
  assert.notEqual(
    buildListing({ ...listing, style: "brief" }).description,
    r.description,
  );
});
test("local listings and job repositories are scoped and reject incompatible records", () => {
  assert.deepEqual(
    parseListings(JSON.stringify(emptyListings("a")), "a"),
    emptyListings("a"),
  );
  assert.equal(parseListings(JSON.stringify(emptyListings("a")), "b"), null);
  assert.deepEqual(
    parseMedia(JSON.stringify(emptyMedia("a")), "a"),
    emptyMedia("a"),
  );
  assert.equal(
    parseMedia(
      JSON.stringify({ ...emptyMedia("a"), jobs: [{ id: "fake" }] }),
      "a",
    ),
    null,
  );
});
test("file validation rejects renamed HTML/SVG, mismatched MIME, empty and huge files", async () => {
  for (const file of [
    new File(["<svg/>"], "x.png", { type: "image/png" }),
    new File([""], "x.png", { type: "image/png" }),
    new File([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], "x.jpg", {
      type: "image/jpeg",
    }),
    new File([new Uint8Array(9 * 1024 * 1024)], "x.png", { type: "image/png" }),
  ])
    await assert.rejects(validateMediaFile(file));
  const png = new File(
    [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])],
    "x.png",
    { type: "image/png" },
  );
  assert.equal(await validateMediaFile(png), "image");
});
