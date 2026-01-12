
// Mock FileDefinedSubject logic
const properties = [
    { key: "required_field" }, // No default, so required
    { key: "optional_field", default: "val" }, // Has default, so optional
    { key: "empty_ok_field" } // No default, user requires it, but empty str is ok
];

function validateParsedData(fields) {
    const warnings = [];
    // properties defined in closure for this test

    for (const prop of properties) {
        // If a property has a default, we don't care if AI missed it (parse() fills it)
        // But if it has NO default, we expect AI to return it (even if empty string)
        if (prop.default === undefined) {
            if (fields[prop.key] === undefined) {
                warnings.push(`AI response missing expected field: '${prop.key}'`);
            }
        }
    }
    return warnings;
}

// --- Tests ---
const tests = [
    {
        name: "All Present",
        fields: { required_field: "A", optional_field: "B", empty_ok_field: "C" },
        expectedWarnings: 0
    },
    {
        name: "Required Missing",
        fields: { optional_field: "B", empty_ok_field: "C" },
        expectedWarnings: 1, // required_field missing
        snippet: "required_field"
    },
    {
        name: "Optional Missing (Should be OK)",
        fields: { required_field: "A", empty_ok_field: "C" },
        expectedWarnings: 0
    },
    {
        name: "Empty String is Valid",
        fields: { required_field: "", optional_field: "B", empty_ok_field: "" },
        expectedWarnings: 0
    }
];

let failed = 0;
console.log("Running AI Result Validation Tests...\n");

for (const t of tests) {
    const warns = validateParsedData(t.fields);
    if (warns.length === t.expectedWarnings) {
        if (t.snippet && !warns[0].includes(t.snippet)) {
            console.log(`[FAIL] ${t.name}: Warned but missed snippet '${t.snippet}':`, warns);
            failed++;
        } else {
            console.log(`[PASS] ${t.name}`);
        }
    } else {
        console.log(`[FAIL] ${t.name}: Expected ${t.expectedWarnings} warnings, got ${warns.length}`, warns);
        failed++;
    }
}

if (failed > 0) process.exit(1);
console.log("\nAll passed.");
