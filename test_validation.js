
// Mock of the function added to SubjectLoader
function validateSubjectDefinition(def) {
    const errors = [];

    // 1. Required Top-Level Fields
    const requiredFields = [
        'subject_name',
        'icon',
        'naming',
        'properties',
        'sections',
        'lead_prompt',
        'trailing_prompt'
    ];

    for (const field of requiredFields) {
        if (!def[field]) {
            errors.push(`Missing required field: '${field}'`);
        }
    }

    // Abort if strict structure is missing to avoid crashing below
    if (errors.length > 0) return errors;

    // 2. Validate Naming
    if (typeof def.naming.note !== 'string') errors.push("Field 'naming.note' must be a string template.");
    if (typeof def.naming.photo !== 'string') errors.push("Field 'naming.photo' must be a string template.");

    // 3. Validate Properties
    if (!Array.isArray(def.properties)) {
        errors.push("'properties' must be a list (array).");
    } else {
        const keys = new Set();
        def.properties.forEach((prop, index) => {
            if (!prop.key) {
                errors.push(`Property at index ${index} is missing 'key'.`);
                return;
            }

            // Duplicate key check
            if (keys.has(prop.key)) {
                errors.push(`Duplicate property key found: '${prop.key}'.`);
            }
            keys.add(prop.key);

            // Must have instruction OR default
            const hasInstruction = typeof prop.instruction === 'string' && prop.instruction.trim().length > 0;
            const hasDefault = prop.default !== undefined;

            if (!hasInstruction && !hasDefault) {
                errors.push(`Property '${prop.key}' must have either an 'instruction' or a 'default' value.`);
            }
        });

        // Optional: Check if naming templates use valid keys
        const templateVarRegex = /\{\{([^}]+)\}\}/g;
        const checkTemplate = (tmpl, loc) => {
            let match;
            while ((match = templateVarRegex.exec(tmpl)) !== null) {
                const key = match[1].trim();
                // Allow system keys or property keys
                if (!keys.has(key) && key !== 'title' && key !== 'producer') {
                    errors.push(`Template '${loc}' uses unknown variable '{{${key}}}'. Must match a property key.`);
                }
            }
        };
        if (typeof def.naming.note === 'string') checkTemplate(def.naming.note, 'naming.note');
        if (typeof def.naming.photo === 'string') checkTemplate(def.naming.photo, 'naming.photo');
    }

    // 4. Validate Sections
    if (!Array.isArray(def.sections)) {
        errors.push("'sections' must be a list (array).");
    } else {
        def.sections.forEach((sec, index) => {
            if (!sec.heading) errors.push(`Section at index ${index} is missing 'heading'.`);
            if (!sec.instruction) errors.push(`Section at index ${index} ('${sec.heading || 'unknown'}') is missing 'instruction'.`);
        });
    }

    // 5. Types check for optionals
    if (def.validate_subject !== undefined && typeof def.validate_subject !== 'boolean') {
        errors.push("'validate_subject' must be a boolean.");
    }
    if (def.validation_threshold !== undefined && typeof def.validation_threshold !== 'number') {
        errors.push("'validation_threshold' must be a number.");
    }

    return errors;
}

// --- TEST RUNNER ---

const tests = [
    {
        name: "Valid Definition (Minimal)",
        input: {
            subject_name: "Test",
            icon: "star",
            naming: { note: "{{test}}", photo: "{{test}}" },
            properties: [{ key: "test", instruction: "inst" }],
            sections: [{ heading: "H1", instruction: "Do it" }],
            lead_prompt: "lead",
            trailing_prompt: "trail"
        },
        expectValid: true
    },
    {
        name: "Missing required field (subject_name)",
        input: {
            // subject_name missing
            icon: "star",
            naming: { note: "{{test}}", photo: "{{test}}" },
            properties: [{ key: "test", instruction: "inst" }],
            sections: [{ heading: "H1", instruction: "Do it" }],
            lead_prompt: "lead",
            trailing_prompt: "trail"
        },
        expectValid: false,
        expectedErrorSnippet: "Missing required field: 'subject_name'"
    },
    {
        name: "Invalid Property (No key)",
        input: {
            subject_name: "Test",
            icon: "star",
            naming: { note: "{{test}}", photo: "{{test}}" },
            properties: [{ instruction: "inst" }], // No key
            sections: [{ heading: "H1", instruction: "Do it" }],
            lead_prompt: "lead",
            trailing_prompt: "trail"
        },
        expectValid: false,
        expectedErrorSnippet: "missing 'key'"
    },
    {
        name: "Invalid Property (No instruction or default)",
        input: {
            subject_name: "Test",
            icon: "star",
            naming: { note: "{{test}}", photo: "{{test}}" },
            properties: [{ key: "test" }], // No instruction/default
            sections: [{ heading: "H1", instruction: "Do it" }],
            lead_prompt: "lead",
            trailing_prompt: "trail"
        },
        expectValid: false,
        expectedErrorSnippet: "must have either an 'instruction' or a 'default'"
    },
    {
        name: "Duplicate Property Key",
        input: {
            subject_name: "Test",
            icon: "star",
            naming: { note: "{{test}}", photo: "{{test}}" },
            properties: [
                { key: "test", instruction: "inst" },
                { key: "test", instruction: "inst2" }
            ],
            sections: [{ heading: "H1", instruction: "Do it" }],
            lead_prompt: "lead",
            trailing_prompt: "trail"
        },
        expectValid: false,
        expectedErrorSnippet: "Duplicate property key"
    },
    {
        name: "Unknown Template Variable",
        input: {
            subject_name: "Test",
            icon: "star",
            naming: { note: "{{BAD_VAR}}", photo: "{{test}}" },
            properties: [{ key: "test", instruction: "inst" }],
            sections: [{ heading: "H1", instruction: "Do it" }],
            lead_prompt: "lead",
            trailing_prompt: "trail"
        },
        expectValid: false,
        expectedErrorSnippet: "unknown variable '{{BAD_VAR}}'"
    }
];

let failed = 0;
console.log("Running Validation Tests...\n");

for (const t of tests) {
    const errors = validateSubjectDefinition(t.input);
    const isValid = errors.length === 0;

    if (isValid === t.expectValid) {
        if (!isValid && t.expectedErrorSnippet) {
            const found = errors.some(e => e.includes(t.expectedErrorSnippet));
            if (!found) {
                console.log(`[FAIL] ${t.name}: Expected error matching "${t.expectedErrorSnippet}" but got: ${JSON.stringify(errors)}`);
                failed++;
                continue;
            }
        }
        console.log(`[PASS] ${t.name}`);
    } else {
        console.log(`[FAIL] ${t.name}: Expected valid=${t.expectValid}, got valid=${isValid}`);
        console.log("Errors:", errors);
        failed++;
    }
}

if (failed > 0) {
    console.log(`\n${failed} tests FAILED.`);
    process.exit(1);
} else {
    console.log("\nAll tests PASSED.");
    process.exit(0);
}
