import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

test('exercise bank meets all criteria', () => {
  const catalog = JSON.parse(readFileSync(new URL('../shared/exercises.json', import.meta.url), 'utf8'));

  const courseIds = [
    'ensembles-nombres', 'arithmetique-n', 'calcul-vectoriel', 'projection-plan', 'ordre-r',
    'droite-plan', 'polynomes', 'equations-systemes', 'trigonometrie-calcul', 'trigonometrie-equations',
    'fonctions', 'transformations-plan', 'produit-scalaire', 'geometrie-espace', 'statistiques'
  ];

  // Exactly 90 exercises
  assert.equal(catalog.length, 90, 'Catalog should contain exactly 90 exercises');

  const groups = new Map();
  const ids = new Set();
  const prompts = new Set();

  for (const exercise of catalog) {
    // Collect for course group counts
    if (!groups.has(exercise.courseId)) groups.set(exercise.courseId, []);
    groups.get(exercise.courseId).push(exercise);

    // Unique ID
    assert.equal(ids.has(exercise.id), false, `Duplicate ID found: ${exercise.id}`);
    ids.add(exercise.id);

    // Unique Prompt
    assert.equal(prompts.has(exercise.prompt), false, `Duplicate prompt found: ${exercise.prompt}`);
    prompts.add(exercise.prompt);

    // No stale statement field
    assert.equal(exercise.statement, undefined, `Stale statement field found on: ${exercise.id}`);

    // Complete metadata
    assert.ok(exercise.source, `Missing source on: ${exercise.id}`);
    assert.ok(exercise.examiner, `Missing examiner on: ${exercise.id}`);
    assert.ok(exercise.reference, `Missing reference on: ${exercise.id}`);
    assert.ok(Array.isArray(exercise.hints), `Missing or invalid hints on: ${exercise.id}`);
    assert.ok(Array.isArray(exercise.skills), `Missing or invalid skills on: ${exercise.id}`);
    assert.ok(exercise.responseType, `Missing responseType on: ${exercise.id}`);
    assert.ok(exercise.rubric, `Missing rubric on: ${exercise.id}`);

    // Bounds validation
    assert.ok(exercise.difficulty >= 1 && exercise.difficulty <= 5, `Difficulty out of bounds on: ${exercise.id}`);
    assert.ok(exercise.durationMin > 0, `Duration must be positive on: ${exercise.id}`);
    assert.ok(exercise.points > 0, `Points must be positive on: ${exercise.id}`);
    assert.ok(exercise.year >= 2000 && exercise.year <= 2030, `Year seems unrealistic on: ${exercise.id}`);
  }

  // Exactly 15 courses
  assert.deepEqual([...groups.keys()].sort(), courseIds.sort(), 'Mismatch in course IDs');

  // Exactly 6 exercises per course
  for (const [courseId, exercises] of groups.entries()) {
    assert.equal(exercises.length, 6, `Course ${courseId} should have exactly 6 exercises, but has ${exercises.length}`);
  }
});
