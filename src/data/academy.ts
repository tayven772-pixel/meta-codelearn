export type Language = {
  id: string;
  name: string;
  category: 'General' | 'Web' | 'Systems' | 'Data';
  level: 'Beginner' | 'Beginner friendly' | 'Foundational';
  description: string;
  sampleCode: string;
};

export type Lesson = {
  id: string;
  title: string;
  concept: string;
  duration: string;
  explanation: string;
  examplesByLanguage: Record<string, string>;
  exercisePrompt: string;
  acceptedAnswers: string[];
  hint: string;
  solutionExplanation: string;
  quiz: { question: string; options: string[]; answerIndex: number; explanation: string }[];
  nextLessonId: string | null;
};

export type LearnerSkillLevel = 'beginner' | 'intermediate' | 'pro';
export type Progress = {
  completedLessonIds: string[];
  completedQuizLessonIds?: string[];
  skillLevel?: LearnerSkillLevel;
};

export const languages: Language[] = [
  { id: 'python', name: 'Python', category: 'General', level: 'Beginner friendly', description: 'A readable first language for automations, data, and a little bit of everything.', sampleCode: 'print("Hello")' },
  { id: 'javascript', name: 'JavaScript', category: 'Web', level: 'Beginner friendly', description: 'The language that makes web pages interactive, and now much more.', sampleCode: 'console.log("Hello")' },
  { id: 'typescript', name: 'TypeScript', category: 'Web', level: 'Beginner', description: 'JavaScript with helpful labels that catch mistakes before they run.', sampleCode: 'const hello: string' },
  { id: 'html-css', name: 'HTML & CSS', category: 'Web', level: 'Foundational', description: 'The building blocks and visual styling behind every web page.', sampleCode: '<h1>Hello</h1>' },
  { id: 'java', name: 'Java', category: 'General', level: 'Beginner', description: 'A structured, widely used language for apps and larger systems.', sampleCode: 'System.out.println()' },
  { id: 'c', name: 'C', category: 'Systems', level: 'Beginner', description: 'A small, close-to-the-metal language that reveals how computers work.', sampleCode: 'printf("Hello");' },
  { id: 'cpp', name: 'C++', category: 'Systems', level: 'Beginner', description: 'C with more tools for building games, engines, and fast software.', sampleCode: 'std::cout << "Hi";' },
  { id: 'csharp', name: 'C#', category: 'General', level: 'Beginner', description: 'A versatile language for desktop apps, services, and Unity games.', sampleCode: 'Console.WriteLine()' },
  { id: 'go', name: 'Go', category: 'Systems', level: 'Beginner friendly', description: 'A straightforward language built for dependable tools and services.', sampleCode: 'fmt.Println("Hello")' },
  { id: 'rust', name: 'Rust', category: 'Systems', level: 'Beginner', description: 'A careful, modern systems language with safety built into its design.', sampleCode: 'println!("Hello");' },
  { id: 'sql', name: 'SQL', category: 'Data', level: 'Beginner friendly', description: 'A practical way to ask questions of information stored in tables.', sampleCode: 'SELECT * FROM notes;' },
  { id: 'ruby', name: 'Ruby', category: 'General', level: 'Beginner friendly', description: 'An expressive language designed to make code feel natural to read.', sampleCode: 'puts "Hello"' },
];

const output = {
  python: 'print("Hello, world!")',
  javascript: 'console.log("Hello, world!");',
  typescript: 'console.log("Hello, world!");',
  'html-css': '<h1>Hello, world!</h1>',
  java: 'System.out.println("Hello, world!");',
  c: 'printf("Hello, world!\\n");',
  cpp: 'std::cout << "Hello, world!\\n";',
  csharp: 'Console.WriteLine("Hello, world!");',
  go: 'fmt.Println("Hello, world!")',
  rust: 'println!("Hello, world!");',
  sql: "SELECT 'Hello, world!';",
  ruby: 'puts "Hello, world!"',
};
const values = {
  python: 'name = "Mina"\\nvisits = 3',
  javascript: 'let name = "Mina";\\nlet visits = 3;',
  typescript: 'let name: string = "Mina";\\nlet visits: number = 3;',
  'html-css': '<p class="name">Mina</p>\\n<style>.name { color: teal; }</style>',
  java: 'String name = "Mina";\\nint visits = 3;',
  c: 'char name[] = "Mina";\\nint visits = 3;',
  cpp: 'std::string name = "Mina";\\nint visits = 3;',
  csharp: 'string name = "Mina";\\nint visits = 3;',
  go: 'name := "Mina"\\nvisits := 3',
  rust: 'let name = "Mina";\\nlet visits = 3;',
  sql: "SELECT 'Mina' AS name, 3 AS visits;",
  ruby: 'name = "Mina"\\nvisits = 3',
};
const conditionals = {
  python: 'if temperature > 25:\\n    print("Warm day")\\nelse:\\n    print("Cool day")',
  javascript: 'if (temperature > 25) {\\n  console.log("Warm day");\\n} else {\\n  console.log("Cool day");\\n}',
  typescript: 'if (temperature > 25) {\\n  console.log("Warm day");\\n} else {\\n  console.log("Cool day");\\n}',
  'html-css': '<p class="warm">Warm day</p>\\n<style>.warm { color: tomato; }</style>',
  java: 'if (temperature > 25) {\\n  System.out.println("Warm day");\\n} else {\\n  System.out.println("Cool day");\\n}',
  c: 'if (temperature > 25) {\\n  printf("Warm day");\\n} else {\\n  printf("Cool day");\\n}',
  cpp: 'if (temperature > 25) {\\n  std::cout << "Warm day";\\n} else {\\n  std::cout << "Cool day";\\n}',
  csharp: 'if (temperature > 25) {\\n  Console.WriteLine("Warm day");\\n} else {\\n  Console.WriteLine("Cool day");\\n}',
  go: 'if temperature > 25 {\\n  fmt.Println("Warm day")\\n} else {\\n  fmt.Println("Cool day")\\n}',
  rust: 'if temperature > 25 {\\n  println!("Warm day");\\n} else {\\n  println!("Cool day");\\n}',
  sql: "SELECT CASE WHEN temperature > 25 THEN 'Warm day'\\n  ELSE 'Cool day' END AS forecast;",
  ruby: 'if temperature > 25\\n  puts "Warm day"\\nelse\\n  puts "Cool day"\\nend',
};
const loops = {
  python: 'for number in range(1, 4):\\n    print(number)',
  javascript: 'for (let number = 1; number <= 3; number++) {\\n  console.log(number);\\n}',
  typescript: 'for (let number = 1; number <= 3; number++) {\\n  console.log(number);\\n}',
  'html-css': '<!-- Repeated content is usually generated by JavaScript -->\\n<ul><li>One</li><li>Two</li></ul>',
  java: 'for (int number = 1; number <= 3; number++) {\\n  System.out.println(number);\\n}',
  c: 'for (int number = 1; number <= 3; number++) {\\n  printf("%d\\\\n", number);\\n}',
  cpp: 'for (int number = 1; number <= 3; number++) {\\n  std::cout << number << "\\\\n";\\n}',
  csharp: 'for (int number = 1; number <= 3; number++) {\\n  Console.WriteLine(number);\\n}',
  go: 'for number := 1; number <= 3; number++ {\\n  fmt.Println(number)\\n}',
  rust: 'for number in 1..=3 {\\n  println!("{number}");\\n}',
  sql: 'SELECT number FROM generate_series(1, 3) AS number;',
  ruby: 'for number in 1..3\\n  puts number\\nend',
};
const functions = {
  python: 'def greet(name):\\n    return "Hello, " + name',
  javascript: 'function greet(name) {\\n  return "Hello, " + name;\\n}',
  typescript: 'function greet(name: string): string {\\n  return "Hello, " + name;\\n}',
  'html-css': '<!-- Reusable page pieces are composed with templates or components. -->\\n<template><p>Hello, <slot></slot></p></template>',
  java: 'static String greet(String name) {\\n  return "Hello, " + name;\\n}',
  c: 'char* greet(char* name) {\\n  return name; /* functions can return a value */\\n}',
  cpp: 'std::string greet(std::string name) {\\n  return "Hello, " + name;\\n}',
  csharp: 'string Greet(string name) {\\n  return "Hello, " + name;\\n}',
  go: 'func greet(name string) string {\\n  return "Hello, " + name\\n}',
  rust: 'fn greet(name: &str) -> String {\\n  format!("Hello, {name}")\\n}',
  sql: 'CREATE FUNCTION greet(name text)\\nRETURNS text AS $$ SELECT \'Hello, \' || name; $$ LANGUAGE SQL;',
  ruby: 'def greet(name)\\n  "Hello, #{name}"\\nend',
};
const collections = {
  python: 'colors = ["red", "green", "blue"]\\nprint(colors[0])',
  javascript: 'const colors = ["red", "green", "blue"];\\nconsole.log(colors[0]);',
  typescript: 'const colors: string[] = ["red", "green", "blue"];\\nconsole.log(colors[0]);',
  'html-css': '<ul>\\n  <li>red</li><li>green</li><li>blue</li>\\n</ul>',
  java: 'String[] colors = {"red", "green", "blue"};\\nSystem.out.println(colors[0]);',
  c: 'char* colors[] = {"red", "green", "blue"};\\nprintf("%s", colors[0]);',
  cpp: 'std::vector<std::string> colors = {"red", "green", "blue"};\\nstd::cout << colors[0];',
  csharp: 'string[] colors = { "red", "green", "blue" };\\nConsole.WriteLine(colors[0]);',
  go: 'colors := []string{"red", "green", "blue"}\\nfmt.Println(colors[0])',
  rust: 'let colors = ["red", "green", "blue"];\\nprintln!("{}", colors[0]);',
  sql: "SELECT color FROM (VALUES ('red'), ('green'), ('blue')) AS colors(color);",
  ruby: 'colors = ["red", "green", "blue"]\\nputs colors[0]',
};

export const lessons: Lesson[] = [
  {
    id: 'output', title: 'Make it say hello', concept: 'Output', duration: '4 min',
    explanation: 'Programs can send information somewhere a person can see it. That action is called **output**. A print or log instruction takes the value inside its parentheses (or after its keyword) and shows it in a console.',
    examplesByLanguage: output,
    exercisePrompt: 'Write one line of code in your selected language that displays the words Hello, learner!',
    acceptedAnswers: ['print("Hello, learner!")', "print('Hello, learner!')", 'console.log("Hello, learner!");', "console.log('Hello, learner!');", 'System.out.println("Hello, learner!");', 'printf("Hello, learner!\\n");', 'std::cout << "Hello, learner!\\n";', 'Console.WriteLine("Hello, learner!");', 'fmt.Println("Hello, learner!")', 'println!("Hello, learner!");', "SELECT 'Hello, learner!';", 'puts "Hello, learner!"', '<h1>Hello, learner!</h1>'],
    hint: 'Look at the example above. Keep the same print or log instruction and replace its message with “Hello, learner!”.',
    solutionExplanation: 'You passed a text value to the language’s output instruction. The surrounding quotes mark the text as a string; the print or log command makes it visible.',
    quiz: [{"question":"Which Python instruction displays text?","options":["input()","print()","return"],"answerIndex":1,"explanation":"print() sends a value to the output area."},{"question":"What do quotation marks usually identify in this example?","options":["A text string","A loop","A condition"],"answerIndex":0,"explanation":"Quotation marks wrap text values, commonly called strings."},{"question":"What is output mainly used for?","options":["Repeating code","Showing information","Naming a variable"],"answerIndex":1,"explanation":"Output lets a program show information to a person or another system."}],
    nextLessonId: 'values',
  },
  {
    id: 'values', title: 'Give a value a name', concept: 'Values & variables', duration: '5 min',
    explanation: 'A variable is a name that lets your program keep a value close at hand. Think of it like a labeled drawer: the name points to information you can use later. Some languages ask you to name the value’s type; others infer it.',
    examplesByLanguage: values,
    exercisePrompt: 'Create a variable named score and give it the number 12.',
    acceptedAnswers: ['score = 12', 'let score = 12;', 'const score = 12;', 'let score: number = 12;', 'int score = 12;', 'var score = 12;', 'score := 12', 'let score = 12;', 'SELECT 12 AS score;', 'score = 12;', '<p>12</p>'],
    hint: 'Start with the name score, then use an equals sign and the number 12. In some languages, include a type such as int or number.',
    solutionExplanation: 'The name score now refers to the numeric value 12. The equals sign assigns the value; it does not mean “is equal to” in the algebra sense here.',
    quiz: [{"question":"What is a variable?","options":["A named reference to a value","A kind of loop","A syntax error"],"answerIndex":0,"explanation":"Variables give values names so programs can use them later."},{"question":"After score = 12, what value is assigned to score?","options":["The text 'score'","12","Nothing; it only compares"],"answerIndex":1,"explanation":"The assignment gives the variable score the number 12."},{"question":"In let name = 'Mina', which part is the variable name?","options":["Mina","let","name"],"answerIndex":2,"explanation":"name is the identifier that refers to the assigned value."}],
    nextLessonId: 'conditions',
  },
  {
    id: 'conditions', title: 'Let a choice branch', concept: 'Conditionals', duration: '6 min',
    explanation: 'A conditional lets a program choose what to do. It checks a true-or-false condition, then runs one path if it is true and another if it is false. The idea is shared even when the punctuation changes.',
    examplesByLanguage: conditionals,
    exercisePrompt: 'Write a condition that checks whether score is greater than 10. Inside its true branch, display “Great job!”.',
    acceptedAnswers: ['if score > 10: print("Great job!")', 'if score > 10: print(\'Great job!\')', 'if (score > 10) { console.log("Great job!"); }', 'if (score > 10) { console.log(\'Great job!\'); }', 'if (score > 10) { Console.WriteLine("Great job!"); }', 'if score > 10 { fmt.Println("Great job!") }', 'if score > 10 { println!("Great job!"); }'],
    hint: 'Use the greater-than operator >, then put your output line inside the if block. The braces or indentation mark that block.',
    solutionExplanation: 'The condition score > 10 evaluates to true or false. The output only runs when the comparison is true.',
    quiz: [{"question":"What does a conditional help a program do?","options":["Choose a path based on a condition","Store every value in a list","Repeat forever"],"answerIndex":0,"explanation":"A condition evaluates to true or false and determines which branch runs."},{"question":"Which operator commonly means 'greater than'?","options":["=","<",">"],"answerIndex":2,"explanation":"The > operator compares whether the left value is greater than the right."},{"question":"When does the true branch of an if statement run?","options":["When the condition is true","Only when the program closes","Every time, regardless of the condition"],"answerIndex":0,"explanation":"The true branch runs only when its condition evaluates to true."}],
    nextLessonId: 'loops',
  },
  {
    id: 'loops', title: 'Repeat without repeating yourself', concept: 'Loops', duration: '6 min',
    explanation: 'A loop repeats a block of instructions. Instead of copying the same line again and again, describe how many times to run it or which items to visit. This makes repetition easier to change and less error-prone.',
    examplesByLanguage: loops,
    exercisePrompt: 'Write a loop that displays the numbers 1, 2, and 3.',
    acceptedAnswers: ['for number in range(1, 4): print(number)', 'for (let number = 1; number <= 3; number++) { console.log(number); }', 'for (let number = 1; number <= 3; number++) { console.log(number) }', 'for (int number = 1; number <= 3; number++) { System.out.println(number); }', 'for number := 1; number <= 3; number++ { fmt.Println(number) }', 'for number in 1..=3 { println!("{number}"); }', 'for number in 1..3 puts number end'],
    hint: 'Use the example loop as your pattern. Check whether your language’s ending number is included in its range.',
    solutionExplanation: 'The loop starts at 1 and advances until it has handled 3. One loop body does the output work for each number.',
    quiz: [{"question":"When is a loop useful?","options":["When instructions need to repeat","Only when naming a variable","To style a web page"],"answerIndex":0,"explanation":"Loops repeat a block of instructions without duplicating the code."},{"question":"In Python, what numbers does range(1, 4) produce?","options":["1, 2, 3, 4","1, 2, 3","0, 1, 2, 3, 4"],"answerIndex":1,"explanation":"The start is included and the stop value 4 is excluded."},{"question":"Why should a loop have a clear stopping condition?","options":["To avoid unintended endless repetition","To make every variable a string","To hide the output"],"answerIndex":0,"explanation":"A stopping rule helps the loop finish when its work is done."}],
    nextLessonId: 'functions',
  },
  {
    id: 'functions', title: 'Package a useful action', concept: 'Functions', duration: '7 min',
    explanation: 'A function is a named set of instructions you can use again. It can accept input (called an argument) and send a result back with return. Functions give a program smaller, easier-to-understand jobs.',
    examplesByLanguage: functions,
    exercisePrompt: 'Define a function named double that takes a number and returns that number multiplied by 2.',
    acceptedAnswers: ['def double(number): return number * 2', 'function double(number) { return number * 2; }', 'function double(number: number): number { return number * 2; }', 'int double(int number) { return number * 2; }', 'func double(number int) int { return number * 2 }', 'fn double(number: i32) -> i32 { number * 2 }', 'def double(number) number * 2 end'],
    hint: 'Give it a name, accept one parameter, then return parameter × 2. The return keyword sends the answer back.',
    solutionExplanation: 'The function describes a reusable rule. Calling double(4), for example, returns 8 without rewriting the multiplication.',
    quiz: [{"question":"What is a function?","options":["A reusable named block of behavior","A list of unrelated values","A comparison operator"],"answerIndex":0,"explanation":"Functions package useful work so it can be called again."},{"question":"What is a parameter used for?","options":["To provide an input to a function","To stop the whole program","To choose a page color"],"answerIndex":0,"explanation":"Parameters name the inputs a function can receive."},{"question":"What does return commonly do?","options":["Repeats the function automatically","Sends a result back to the caller","Creates a loop"],"answerIndex":1,"explanation":"return gives a result back to the code that called the function."}],
    nextLessonId: 'collections',
  },
  {
    id: 'collections', title: 'Keep values together', concept: 'Collections', duration: '6 min',
    explanation: 'A collection keeps multiple values under one name. Lists and arrays are ordered, so you can ask for an item by its position. In many languages, positions start at zero: the first item is at index 0.',
    examplesByLanguage: collections,
    exercisePrompt: 'Create a list called tools containing the text values “pen” and “notebook”.',
    acceptedAnswers: ['tools = ["pen", "notebook"]', 'let tools = ["pen", "notebook"];', 'const tools = ["pen", "notebook"];', 'let tools: string[] = ["pen", "notebook"];', 'String[] tools = {"pen", "notebook"};', 'string[] tools = { "pen", "notebook" };', 'tools := []string{"pen", "notebook"}', 'let tools = ["pen", "notebook"];'],
    hint: 'Use square brackets around the items and separate them with a comma. Each text value needs quotes.',
    solutionExplanation: 'The two values live in one ordered collection called tools. In an array-style collection, tools[0] would refer to “pen”.',
    quiz: [{"question":"Why use a collection such as a list or array?","options":["To keep multiple values together","To replace every function","To make conditions unnecessary"],"answerIndex":0,"explanation":"Collections group related values under one variable or structure."},{"question":"What is the first index in many programming languages?","options":["1","-1","0"],"answerIndex":2,"explanation":"Many lists and arrays start counting positions at index 0."},{"question":"If colors = ['red', 'green', 'blue'], what does colors[0] usually refer to?","options":["red","green","blue"],"answerIndex":0,"explanation":"Index 0 refers to the first item, which is red."}],
    nextLessonId: null,
  },
];

export const lessonFor = (id: string | undefined) => lessons.find((lesson) => lesson.id === id);
export const languageFor = (id: string) => languages.find((language) => language.id === id) ?? languages[0];