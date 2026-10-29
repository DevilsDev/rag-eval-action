// Offline test LLM: answers with the top passage. RAG_EVAL_TEST_ANSWER
// replaces the answer, so a test can make a run worse than its baseline.
module.exports = class EchoLLM {
  async generate(query, docs) {
    return process.env.RAG_EVAL_TEST_ANSWER || (docs[0] ? docs[0].content : "No information found.");
  }
};
