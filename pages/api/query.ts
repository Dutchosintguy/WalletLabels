// import middlewares from "@/pages/api/rateLimits"
import middlewares from "@/lib/rateLimits"
import { connectToDatabase } from "../../lib/mongodb"

export default async function handler(req, res) {
  try {
    await Promise.all(middlewares.map((middleware) => middleware(req, res)))
  } catch {
    return res.status(429).send("Too Many Requests")
  }

  let db
  //wrap db connection in try/catch
  try {
    db = await connectToDatabase()
    db = db.db
  } catch (error) {
    console.log(error)
    throw new Error("Unable to connect to database")
  }

  // get limit otherwise set to 500

  // get query from req
  //  if undefined set to empty
  if (req.query.query === undefined) {
    res.status(400).json({ message: "Bad request" })
  }
  // if query is not defined, set to empty string
  // if query is defined, set to query
  let query, limit
  if (req.query.query === "" || req.query.query === undefined) {
    query = ""
  } else {
    query = req.query.query
  }

  if (req.query.limit === "" || req.query.limit === undefined) {
    limit = 20
  } else {
    limit = Number(req.query.limit)
  }

  // max limit is 100
  if (limit > 100) {
    limit = 100
  }

  // limit to only GET method or throw error
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" })
  }
  // return labels
  // limit to 5000 results based on query field in req
  //search index address_name_text_label_type_text_label_subtype_text
  //for query string

  //if query is empty don't search
  let labels = null
  try {
    if (query === "") {
      labels = await db.collection("labels").find().limit(limit).toArray()
    } else {
      // build atlas search query
      const atlasSearchQuery = [
        {
          $search: {
            index: "search",
            text: {
              query: query,
              path: [
                "address_name",
                "label_type",
                "label_subtype",
                "address",
                "label",
              ],
            },
          },
        },
        {
          $limit: limit,
        },
      ]
      labels = await db
        .collection("labels")
        .aggregate(atlasSearchQuery)
        .toArray()
    }
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: "Internal server error" })
    return
  }

  const response = {
    data: labels,
  }
  res.status(200).json(response)
}
