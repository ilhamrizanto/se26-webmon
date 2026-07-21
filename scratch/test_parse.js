const part1 = "21 Jul 2026, 08.18 No (1)";
const part2 = "21 Jul 2026, 08.18";

function clean(part) {
    return part.split(/\s*no/i)[0].trim();
}

console.log("part1 clean:", clean(part1));
console.log("part2 clean:", clean(part2));
